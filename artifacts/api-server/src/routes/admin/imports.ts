import { Router, type IRouter, raw as rawBody } from "express";
import { eq, desc } from "drizzle-orm";
import { z } from "zod";
import {
  db,
  suppliersTable,
  importRunsTable,
  usersTable,
  type SupplierColumnMapping,
  type FeedFormat,
} from "@workspace/db";
import { parseFeed } from "../../lib/feed-parsers";
import { executeImportRun, IMPORTABLE_FIELDS } from "../../lib/import-engine";
import type { RequestWithAdmin } from "../../middlewares/admin";
import { fetchFeedFromUrl, FeedFetchError } from "../../lib/fetch-feed";

const router: IRouter = Router();

const MAX_FEED_BYTES = 10 * 1024 * 1024; // 10 MB
const MAX_PREVIEW_ROWS = 20;

const FEED_FORMATS: FeedFormat[] = ["csv", "json", "xml", "shopify"];

const RAW_BODY_TYPES = [
  "text/csv",
  "text/plain",
  "application/csv",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/octet-stream",
  "application/json",
  "application/xml",
  "text/xml",
];

// ─── helpers ─────────────────────────────────────────────────────────────────

/**
 * Get a raw byte buffer from the request body, regardless of content-type.
 *
 * For text/csv and xlsx uploads the `rawBody()` middleware runs first and
 * `req.body` is already a Buffer.
 *
 * For application/json uploads the global `express.json()` middleware runs
 * first (before route handlers) and parses the body into an object, but its
 * `verify` function stores the untouched bytes on `req.rawBody`. We fall back
 * to that here so JSON/Shopify file uploads work correctly.
 */
function getBodyBuffer(req: import("express").Request): Buffer | null {
  if (Buffer.isBuffer(req.body) && (req.body as Buffer).length > 0) {
    return req.body as Buffer;
  }
  if (req.rawBody && req.rawBody.length > 0) {
    return req.rawBody;
  }
  return null;
}

function resolveFormat(raw: unknown, fallback: FeedFormat = "csv"): FeedFormat {
  if (typeof raw === "string" && (FEED_FORMATS as string[]).includes(raw)) {
    return raw as FeedFormat;
  }
  return fallback;
}


// ─── /admin/imports/preview ──────────────────────────────────────────────────
// Two ways to invoke:
//   POST /admin/imports/preview?format=csv|json|xml|shopify   (body = raw bytes)
//   POST /admin/imports/preview?url=…&format=…               (server fetches URL)

router.post(
  "/admin/imports/preview",
  rawBody({ type: RAW_BODY_TYPES, limit: MAX_FEED_BYTES }),
  async (req, res): Promise<void> => {
    try {
      const url = typeof req.query.url === "string" ? req.query.url : "";
      const format = resolveFormat(req.query.format);

      let buf: Buffer | null = null;
      if (url) {
        buf = await fetchFeedFromUrl(url);
      } else {
        buf = getBodyBuffer(req);
        if (!buf) {
          res.status(400).json({ error: "Provide a feed file body or ?url= parameter" });
          return;
        }
      }

      const { headers, rows, totalRows } = parseFeed(buf, format, { maxRows: MAX_PREVIEW_ROWS });
      res.json({
        headers,
        sample: rows,
        sampleSize: rows.length,
        totalRows,
        importableFields: IMPORTABLE_FIELDS,
      });
    } catch (err) {
      if (err instanceof FeedFetchError) {
        res.status(err.status).json({ error: err.message });
        return;
      }
      req.log?.error?.({ err }, "import preview failed");
      res.status(500).json({ error: err instanceof Error ? err.message : "Preview failed" });
    }
  },
);

// ─── /admin/imports/run ──────────────────────────────────────────────────────
// Accepts any supported feed body OR a configured supplier URL.
//   POST /admin/imports/run  (application/json)
//     { supplierId, source: "url", mapping?, saveMapping? }
// or
//   POST /admin/imports/run?supplierId=…&format=…&saveMapping=true
//     binary body  (format defaults to supplier.feedFormat)

const RunBodySchema = z.object({
  supplierId: z.number().int().positive(),
  source: z.enum(["url"]),
  mapping: z.record(z.string(), z.string()).optional(),
  saveMapping: z.boolean().optional(),
});

router.post(
  "/admin/imports/run",
  rawBody({
    type: RAW_BODY_TYPES,
    limit: MAX_FEED_BYTES,
  }),
  async (req, res): Promise<void> => {
    try {
      let supplierId = 0;
      let buf: Buffer | null = null;
      let mappingOverride: SupplierColumnMapping | undefined;
      let sourceLabel = "upload";
      let sourceUrl: string | null = null;
      let saveMapping = false;

      // File uploads always supply ?supplierId= as a query param.
      // URL runs supply { supplierId, source: "url" } in a JSON body with no query params.
      // Using this distinction (rather than Buffer.isBuffer) ensures JSON file uploads work
      // even after express.json() has already parsed req.body into an object.
      const hasQuerySupplierId = typeof req.query.supplierId === "string";
      const bodyBuf = getBodyBuffer(req);
      const isFileBody = hasQuerySupplierId && bodyBuf !== null;

      if (isFileBody) {
        supplierId = Number(req.query.supplierId);
        if (!Number.isInteger(supplierId) || supplierId <= 0) {
          res.status(400).json({ error: "Missing/invalid supplierId" });
          return;
        }
        buf = bodyBuf;
        if (typeof req.query.mapping === "string") {
          try {
            mappingOverride = JSON.parse(req.query.mapping) as SupplierColumnMapping;
          } catch {
            res.status(400).json({ error: "Invalid mapping JSON in query" });
            return;
          }
        }
        if (req.query.saveMapping === "true") saveMapping = true;
        sourceLabel = "upload";
      } else {
        // JSON body — must include source: "url"
        const parsed = RunBodySchema.safeParse(req.body);
        if (!parsed.success) {
          res.status(400).json({ error: "Invalid run payload", details: parsed.error.message });
          return;
        }
        supplierId = parsed.data.supplierId;
        mappingOverride = parsed.data.mapping;
        saveMapping = parsed.data.saveMapping ?? false;
        sourceLabel = "url";
      }

      // Resolve supplier
      const [supplier] = await db
        .select()
        .from(suppliersTable)
        .where(eq(suppliersTable.id, supplierId));
      if (!supplier) {
        res.status(404).json({ error: "Supplier not found" });
        return;
      }

      const supplierFormat: FeedFormat = resolveFormat(supplier.feedFormat);

      // For file uploads, ?format= overrides the supplier's saved feedFormat
      const format: FeedFormat =
        isFileBody ? resolveFormat(req.query.format, supplierFormat) : supplierFormat;

      if (!isFileBody) {
        if (!supplier.sourceUrl) {
          res.status(400).json({ error: "Supplier has no source URL configured" });
          return;
        }
        buf = await fetchFeedFromUrl(supplier.sourceUrl);
        sourceUrl = supplier.sourceUrl;
      }

      const mapping: SupplierColumnMapping = mappingOverride ?? supplier.columnMapping ?? {};
      if (!mapping || Object.keys(mapping).length === 0) {
        res.status(400).json({ error: "No column mapping provided" });
        return;
      }

      // Persist mapping back to the supplier when requested
      if (saveMapping && mappingOverride) {
        await db
          .update(suppliersTable)
          .set({ columnMapping: mappingOverride })
          .where(eq(suppliersTable.id, supplierId));
      }

      const { rows } = parseFeed(buf!, format);

      const source = `${format}-${sourceLabel}`;
      const userId = (req as RequestWithAdmin).adminUser?.id ?? null;
      const { runId, result } = await executeImportRun({
        supplierId,
        triggeredByUserId: userId,
        source,
        sourceUrl,
        mapping,
        rows,
      });

      res.json({
        runId,
        ...result,
      });
    } catch (err) {
      if (err instanceof FeedFetchError) {
        res.status(err.status).json({ error: err.message });
        return;
      }
      req.log?.error?.({ err }, "import run failed");
      res.status(500).json({ error: err instanceof Error ? err.message : "Import failed" });
    }
  },
);

// ─── /admin/import-runs ──────────────────────────────────────────────────────

router.get("/admin/import-runs", async (req, res): Promise<void> => {
  const supplierId = req.query.supplierId ? Number(req.query.supplierId) : undefined;
  const baseQuery = db
    .select({
      run: importRunsTable,
      supplierName: suppliersTable.name,
      triggeredByUsername: usersTable.username,
    })
    .from(importRunsTable)
    .leftJoin(suppliersTable, eq(importRunsTable.supplierId, suppliersTable.id))
    .leftJoin(usersTable, eq(importRunsTable.triggeredByUserId, usersTable.id))
    .orderBy(desc(importRunsTable.startedAt))
    .limit(100);

  const rows = supplierId
    ? await baseQuery.where(eq(importRunsTable.supplierId, supplierId))
    : await baseQuery;

  res.json(
    rows.map(({ run, supplierName, triggeredByUsername }) => ({
      ...run,
      supplierName,
      triggeredByUsername,
    })),
  );
});

router.get("/admin/import-runs/:id", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    res.status(400).json({ error: "Invalid run id" });
    return;
  }
  const [row] = await db
    .select({
      run: importRunsTable,
      supplierName: suppliersTable.name,
      triggeredByUsername: usersTable.username,
    })
    .from(importRunsTable)
    .leftJoin(suppliersTable, eq(importRunsTable.supplierId, suppliersTable.id))
    .leftJoin(usersTable, eq(importRunsTable.triggeredByUserId, usersTable.id))
    .where(eq(importRunsTable.id, id));
  if (!row) {
    res.status(404).json({ error: "Run not found" });
    return;
  }
  res.json({
    ...row.run,
    supplierName: row.supplierName,
    triggeredByUsername: row.triggeredByUsername,
  });
});

router.get("/admin/import-runs/:id/errors.csv", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    res.status(400).json({ error: "Invalid run id" });
    return;
  }
  const [row] = await db
    .select()
    .from(importRunsTable)
    .where(eq(importRunsTable.id, id));
  if (!row) {
    res.status(404).json({ error: "Run not found" });
    return;
  }
  const lines: string[] = ["row,external_sku,message"];
  for (const e of row.errors ?? []) {
    const sku = (e.externalSku ?? "").replace(/"/g, '""');
    const msg = (e.message ?? "").replace(/"/g, '""');
    lines.push(`${e.row},"${sku}","${msg}"`);
  }
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="import-run-${id}-errors.csv"`);
  res.send(lines.join("\n"));
});

export default router;
