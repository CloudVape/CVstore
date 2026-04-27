import { Router, type IRouter, raw as rawBody } from "express";
import { eq, desc } from "drizzle-orm";
import { z } from "zod";
import {
  db,
  suppliersTable,
  importRunsTable,
  usersTable,
  type SupplierColumnMapping,
} from "@workspace/db";
import { parseCsv, bufferToCsvText, type CsvRow } from "../../lib/csv";
import { executeImportRun, IMPORTABLE_FIELDS } from "../../lib/import-engine";
import type { RequestWithAdmin } from "../../middlewares/admin";
import { assertPublicHttpUrl, UrlSafetyError } from "../../lib/url-safety";

const router: IRouter = Router();

const MAX_CSV_BYTES = 10 * 1024 * 1024; // 10 MB
const MAX_PREVIEW_ROWS = 20;
const MAX_REDIRECTS = 5;

const RAW_BODY_TYPES = [
  "text/csv",
  "text/plain",
  "application/csv",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/octet-stream",
];

// ─── helpers ─────────────────────────────────────────────────────────────────

class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

/**
 * Fetches a feed URL with SSRF protection. Each redirect hop is re-validated
 * against the private-IP block list. Returns the response body as raw bytes.
 */
async function fetchFeedFromUrl(rawUrl: string): Promise<Buffer> {
  let current = rawUrl;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    let safe: URL;
    try {
      safe = await assertPublicHttpUrl(current);
    } catch (err) {
      if (err instanceof UrlSafetyError) {
        throw new HttpError(err.status, err.message);
      }
      throw err;
    }

    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 30_000);
    let resp: Response;
    try {
      resp = await fetch(safe.toString(), {
        redirect: "manual",
        signal: ctrl.signal,
        headers: { "user-agent": "VapeVault-Importer/1.0" },
      });
    } catch (err) {
      clearTimeout(timer);
      throw new HttpError(
        502,
        `Failed to reach feed URL: ${err instanceof Error ? err.message : "unknown error"}`,
      );
    }
    clearTimeout(timer);

    // Manual redirect handling so we can re-validate the target host.
    if (resp.status >= 300 && resp.status < 400) {
      const loc = resp.headers.get("location");
      if (!loc) {
        throw new HttpError(502, `Redirect with no Location header (HTTP ${resp.status})`);
      }
      // Resolve relative redirects against the previous URL
      current = new URL(loc, safe).toString();
      continue;
    }

    if (!resp.ok) {
      throw new HttpError(resp.status, `Failed to fetch feed: HTTP ${resp.status}`);
    }

    const len = resp.headers.get("content-length");
    if (len && Number(len) > MAX_CSV_BYTES) {
      throw new HttpError(413, "Feed exceeds 10MB limit");
    }
    const ab = await resp.arrayBuffer();
    if (ab.byteLength > MAX_CSV_BYTES) {
      throw new HttpError(413, "Feed exceeds 10MB limit");
    }
    return Buffer.from(ab);
  }
  throw new HttpError(502, `Too many redirects (>${MAX_REDIRECTS})`);
}

// ─── /admin/imports/preview ──────────────────────────────────────────────────
// Two ways to invoke:
//   POST /admin/imports/preview          (Content-Type: text/csv|xlsx) — body
//   POST /admin/imports/preview?url=…    (no body) — server fetches the URL

router.post(
  "/admin/imports/preview",
  rawBody({ type: RAW_BODY_TYPES, limit: MAX_CSV_BYTES }),
  async (req, res): Promise<void> => {
    try {
      const url = typeof req.query.url === "string" ? req.query.url : "";
      let csvText = "";
      if (url) {
        const buf = await fetchFeedFromUrl(url);
        csvText = bufferToCsvText(buf);
      } else if (Buffer.isBuffer(req.body) && req.body.length > 0) {
        csvText = bufferToCsvText(req.body);
      } else {
        res.status(400).json({ error: "Provide CSV/XLSX body or ?url= parameter" });
        return;
      }

      const { headers, rows } = parseCsv(csvText, { maxRows: MAX_PREVIEW_ROWS });
      // Approximate total row count via newline count of the converted text.
      const totalRows = Math.max(
        0,
        csvText.split(/\r\n|\n|\r/).filter((l) => l.trim() !== "").length - 1,
      );
      res.json({
        headers,
        sample: rows,
        sampleSize: rows.length,
        totalRows,
        importableFields: IMPORTABLE_FIELDS,
      });
    } catch (err) {
      if (err instanceof HttpError) {
        res.status(err.status).json({ error: err.message });
        return;
      }
      req.log?.error?.({ err }, "import preview failed");
      res.status(500).json({ error: err instanceof Error ? err.message : "Preview failed" });
    }
  },
);

// ─── /admin/imports/run ──────────────────────────────────────────────────────
// Accepts CSV/XLSX body OR a configured supplier URL.
//   POST /admin/imports/run  (application/json)
//     { supplierId, source: "url" }
// or
//   POST /admin/imports/run?supplierId=…&saveMapping=true   (text/csv | xlsx)
//     binary body
// In both cases, the saved mapping override may be passed as ?mapping= JSON.

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
    limit: MAX_CSV_BYTES,
  }),
  async (req, res): Promise<void> => {
    try {
      let supplierId = 0;
      let csvText = "";
      let mappingOverride: SupplierColumnMapping | undefined;
      let source: "csv-upload" | "csv-url" = "csv-upload";
      let sourceUrl: string | null = null;
      let saveMapping = false;

      const isFileBody = Buffer.isBuffer(req.body) && req.body.length > 0;

      if (isFileBody) {
        supplierId = Number(req.query.supplierId);
        if (!Number.isInteger(supplierId) || supplierId <= 0) {
          res.status(400).json({ error: "Missing/invalid supplierId" });
          return;
        }
        csvText = bufferToCsvText(req.body);
        if (typeof req.query.mapping === "string") {
          try {
            mappingOverride = JSON.parse(req.query.mapping) as SupplierColumnMapping;
          } catch {
            res.status(400).json({ error: "Invalid mapping JSON in query" });
            return;
          }
        }
        if (req.query.saveMapping === "true") saveMapping = true;
        source = "csv-upload";
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
        source = "csv-url";
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

      if (!isFileBody) {
        if (!supplier.sourceUrl) {
          res.status(400).json({ error: "Supplier has no source URL configured" });
          return;
        }
        const buf = await fetchFeedFromUrl(supplier.sourceUrl);
        csvText = bufferToCsvText(buf);
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

      const { rows } = parseCsv(csvText);

      const userId = (req as RequestWithAdmin).adminUser?.id ?? null;
      const { runId, result } = await executeImportRun({
        supplierId,
        triggeredByUserId: userId,
        source,
        sourceUrl,
        mapping,
        rows: rows as CsvRow[],
      });

      res.json({
        runId,
        ...result,
      });
    } catch (err) {
      if (err instanceof HttpError) {
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
