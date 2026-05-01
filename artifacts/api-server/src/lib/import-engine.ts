import { and, eq, sql } from "drizzle-orm";
import {
  db,
  productsTable,
  productCategoriesTable,
  importRunsTable,
  suppliersTable,
  type ImportRowError,
  type SupplierColumnMapping,
} from "@workspace/db";
import { fireAndForget } from "./email";
import { announceNewProduct } from "../jobs/new-arrivals";

/**
 * Importable product fields. The admin maps each of these to a column
 * in the supplier's feed via SupplierColumnMapping.
 *
 *  required: externalSku (always)
 *  required for new products: name, priceCents (existing products keep theirs)
 *  any field present in the mapping & non-empty in the row is updated.
 */
export const IMPORTABLE_FIELDS = [
  { key: "externalSku", required: true, description: "Unique supplier SKU. Used to match products on re-import." },
  { key: "name", required: false, description: "Product display name (required to create new products)." },
  { key: "brand", required: false, description: "Brand or manufacturer." },
  { key: "shortDescription", required: false, description: "One-line subtitle shown in product cards." },
  { key: "description", required: false, description: "Full product description." },
  { key: "priceCents", required: false, description: "Price. Accepts dollars (e.g. 19.99) or cents (1999)." },
  { key: "comparePriceCents", required: false, description: "Optional MSRP / strike-through price." },
  { key: "categorySlug", required: false, description: "Slug of an existing product category." },
  { key: "imageUrl", required: false, description: "Main product image URL." },
  { key: "stockCount", required: false, description: "Available quantity. 0 marks the product out of stock." },
  { key: "flavor", required: false, description: "E-liquid flavor (optional)." },
  { key: "nicotineStrength", required: false, description: "Nicotine strength label, e.g. 3mg." },
  { key: "vgPgRatio", required: false, description: "VG/PG ratio, e.g. 70/30." },
  { key: "bottleSize", required: false, description: "Container size, e.g. 60ml." },
  { key: "tags", required: false, description: "Comma- or pipe-separated tags." },
] as const;

export type ImportableField = (typeof IMPORTABLE_FIELDS)[number]["key"];

export type ImportEngineInput = {
  supplierId: number;
  mapping: SupplierColumnMapping;
  rows: Record<string, string>[];
};

export type ImportEngineResult = {
  totalRows: number;
  createdCount: number;
  updatedCount: number;
  skippedCount: number;
  erroredCount: number;
  errors: ImportRowError[];
};

function slugify(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function parseMoneyCents(raw: string): number | null {
  const cleaned = raw.replace(/[^0-9.,-]/g, "").replace(/,/g, "");
  if (cleaned === "" || cleaned === "-") return null;
  const n = Number(cleaned);
  if (!Number.isFinite(n)) return null;
  // Treat as dollars unless the value already looks like an integer cent count
  // (i.e. no decimal point and >= 1000). A 19.99 -> 1999, a "1999" stays 1999.
  if (cleaned.includes(".")) return Math.round(n * 100);
  return n >= 1000 ? Math.round(n) : Math.round(n * 100);
}

function parseInteger(raw: string): number | null {
  const cleaned = raw.replace(/[^0-9-]/g, "");
  if (cleaned === "" || cleaned === "-") return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? Math.trunc(n) : null;
}

function parseTags(raw: string): string[] {
  return raw
    .split(/[|,;]/)
    .map((t) => t.trim())
    .filter((t) => t.length > 0);
}

/** Get the row value for an importable field, after applying the mapping. */
function pick(
  row: Record<string, string>,
  mapping: SupplierColumnMapping,
  field: ImportableField,
): string {
  const col = mapping[field];
  if (!col) return "";
  const v = row[col];
  return typeof v === "string" ? v.trim() : "";
}

async function ensureUniqueSlug(base: string, ignoreProductId?: number): Promise<string> {
  let candidate = base || `product-${Date.now()}`;
  let suffix = 0;
  // small loop; importer is not high-throughput
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const rows = await db
      .select({ id: productsTable.id })
      .from(productsTable)
      .where(eq(productsTable.slug, candidate));
    const conflict = rows.find((r) => r.id !== ignoreProductId);
    if (!conflict) return candidate;
    suffix++;
    candidate = `${base}-${suffix}`;
  }
}

/** Run an import end-to-end. Collects errors per row instead of aborting. */
export async function runImport({
  supplierId,
  mapping,
  rows,
}: ImportEngineInput): Promise<ImportEngineResult> {
  const result: ImportEngineResult = {
    totalRows: rows.length,
    createdCount: 0,
    updatedCount: 0,
    skippedCount: 0,
    erroredCount: 0,
    errors: [],
  };

  // Pre-load category slug -> id map (lazy / only what we need would be fine
  // too, but the catalogue is tiny).
  const categories = await db
    .select({ id: productCategoriesTable.id, slug: productCategoriesTable.slug })
    .from(productCategoriesTable);
  const categoryIdBySlug = new Map(categories.map((c) => [c.slug, c.id]));
  const fallbackCategoryId = categories[0]?.id;

  let rowIndex = 0;
  for (const row of rows) {
    rowIndex++;
    const externalSku = pick(row, mapping, "externalSku");
    if (!externalSku) {
      result.erroredCount++;
      result.errors.push({
        row: rowIndex,
        externalSku: null,
        message: "Missing external SKU — cannot match or create product",
      });
      continue;
    }

    try {
      // Find existing by (supplierId, externalSku)
      const existingRows = await db
        .select()
        .from(productsTable)
        .where(and(eq(productsTable.supplierId, supplierId), eq(productsTable.externalSku, externalSku)));
      const existing = existingRows[0];

      // Build the patch (only mapped + non-empty values)
      const patch: Record<string, unknown> = {};

      const name = pick(row, mapping, "name");
      if (name) patch.name = name;

      const brand = pick(row, mapping, "brand");
      if (brand) patch.brand = brand;

      const shortDescription = pick(row, mapping, "shortDescription");
      if (shortDescription) patch.shortDescription = shortDescription;

      const description = pick(row, mapping, "description");
      if (description) patch.description = description;

      const priceRaw = pick(row, mapping, "priceCents");
      if (priceRaw) {
        const cents = parseMoneyCents(priceRaw);
        if (cents == null || cents < 0) {
          throw new Error(`Invalid price: "${priceRaw}"`);
        }
        patch.priceCents = cents;
      }

      const compareRaw = pick(row, mapping, "comparePriceCents");
      if (compareRaw) {
        const cents = parseMoneyCents(compareRaw);
        if (cents != null) patch.comparePriceCents = cents;
      }

      const categorySlugRaw = pick(row, mapping, "categorySlug");
      if (categorySlugRaw) {
        const slug = slugify(categorySlugRaw);
        const catId = categoryIdBySlug.get(slug);
        if (!catId) {
          throw new Error(`Unknown category slug "${categorySlugRaw}"`);
        }
        patch.categoryId = catId;
      }

      const imageUrl = pick(row, mapping, "imageUrl");
      if (imageUrl) patch.imageUrl = imageUrl;

      const stockRaw = pick(row, mapping, "stockCount");
      if (stockRaw) {
        const stock = parseInteger(stockRaw);
        if (stock == null || stock < 0) {
          throw new Error(`Invalid stock count: "${stockRaw}"`);
        }
        patch.stockCount = stock;
        patch.inStock = stock > 0;
      }

      const flavor = pick(row, mapping, "flavor");
      if (flavor) patch.flavor = flavor;

      const nic = pick(row, mapping, "nicotineStrength");
      if (nic) patch.nicotineStrength = nic;

      const vg = pick(row, mapping, "vgPgRatio");
      if (vg) patch.vgPgRatio = vg;

      const bottle = pick(row, mapping, "bottleSize");
      if (bottle) patch.bottleSize = bottle;

      const tagsRaw = pick(row, mapping, "tags");
      if (tagsRaw) patch.tags = parseTags(tagsRaw);

      patch.lastSyncedAt = new Date();

      if (existing) {
        // Skip pure-empty patches (only lastSyncedAt would change)
        const hasMeaningfulChange = Object.keys(patch).some((k) => k !== "lastSyncedAt");
        if (!hasMeaningfulChange) {
          result.skippedCount++;
          continue;
        }
        await db.update(productsTable).set(patch).where(eq(productsTable.id, existing.id));
        result.updatedCount++;
      } else {
        // Need name, price, category, image at minimum to create a brand-new product
        if (!patch.name) throw new Error("Missing product name — cannot create new product");
        if (patch.priceCents == null) throw new Error("Missing price — cannot create new product");
        if (patch.categoryId == null) {
          if (fallbackCategoryId == null) {
            throw new Error("No product categories defined in store — cannot create new product");
          }
          patch.categoryId = fallbackCategoryId;
        }
        if (!patch.imageUrl) {
          patch.imageUrl = "https://placehold.co/600x600?text=No+Image";
        }
        if (!patch.brand) patch.brand = "Unknown";
        if (!patch.shortDescription) patch.shortDescription = String(patch.name);
        if (!patch.description) patch.description = String(patch.name);

        const slugBase = slugify(`${patch.brand}-${patch.name}-${externalSku}`);
        const slug = await ensureUniqueSlug(slugBase);

        const newInStock = (patch.inStock as boolean | undefined) ?? false;
        const [inserted] = await db.insert(productsTable).values({
          name: patch.name as string,
          slug,
          brand: patch.brand as string,
          shortDescription: patch.shortDescription as string,
          description: patch.description as string,
          priceCents: patch.priceCents as number,
          comparePriceCents: (patch.comparePriceCents as number | undefined) ?? null,
          categoryId: patch.categoryId as number,
          imageUrl: patch.imageUrl as string,
          stockCount: (patch.stockCount as number | undefined) ?? 0,
          inStock: newInStock,
          flavor: (patch.flavor as string | undefined) ?? null,
          nicotineStrength: (patch.nicotineStrength as string | undefined) ?? null,
          vgPgRatio: (patch.vgPgRatio as string | undefined) ?? null,
          bottleSize: (patch.bottleSize as string | undefined) ?? null,
          tags: (patch.tags as string[] | undefined) ?? [],
          supplierId,
          externalSku,
          lastSyncedAt: new Date(),
        }).returning({ id: productsTable.id });
        result.createdCount++;

        if (newInStock && inserted?.id) {
          fireAndForget(announceNewProduct(inserted.id));
        }
      }
    } catch (err) {
      result.erroredCount++;
      result.errors.push({
        row: rowIndex,
        externalSku: externalSku || null,
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }

  // Refresh productCount on categories so the storefront sidebar stays accurate
  await db.execute(sql`
    UPDATE ${productCategoriesTable}
    SET product_count = (
      SELECT COUNT(*) FROM ${productsTable} WHERE ${productsTable.categoryId} = ${productCategoriesTable.id}
    )
  `);

  return result;
}

/**
 * Wrapper that opens an `import_runs` row, executes the engine, and writes
 * back the summary. Returns the persisted run id.
 */
export async function executeImportRun(opts: {
  supplierId: number;
  triggeredByUserId: number | null;
  source: string;
  sourceUrl: string | null;
  mapping: SupplierColumnMapping;
  rows: Record<string, string>[];
}): Promise<{ runId: number; result: ImportEngineResult }> {
  const [run] = await db
    .insert(importRunsTable)
    .values({
      supplierId: opts.supplierId,
      triggeredByUserId: opts.triggeredByUserId,
      status: "running",
      source: opts.source,
      sourceUrl: opts.sourceUrl,
      totalRows: opts.rows.length,
    })
    .returning();

  try {
    const result = await runImport({
      supplierId: opts.supplierId,
      mapping: opts.mapping,
      rows: opts.rows,
    });
    const finishedAt = new Date();
    await db
      .update(importRunsTable)
      .set({
        status: "completed",
        totalRows: result.totalRows,
        createdCount: result.createdCount,
        updatedCount: result.updatedCount,
        skippedCount: result.skippedCount,
        erroredCount: result.erroredCount,
        errors: result.errors,
        finishedAt,
      })
      .where(eq(importRunsTable.id, run.id));
    await db
      .update(suppliersTable)
      .set({ lastRunAt: finishedAt })
      .where(eq(suppliersTable.id, opts.supplierId));
    return { runId: run.id, result };
  } catch (err) {
    const finishedAt = new Date();
    await db
      .update(importRunsTable)
      .set({
        status: "failed",
        errorMessage: err instanceof Error ? err.message : String(err),
        finishedAt,
      })
      .where(eq(importRunsTable.id, run.id));
    await db
      .update(suppliersTable)
      .set({ lastRunAt: finishedAt })
      .where(eq(suppliersTable.id, opts.supplierId));
    throw err;
  }
}
