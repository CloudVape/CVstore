/**
 * Multi-format feed parser.
 *
 * Supported formats:
 *   csv     – RFC-4180 CSV / XLSX (via existing csv.ts helper)
 *   json    – JSON array or object with a nested data array
 *   xml     – Generic product XML feed (uses fast-xml-parser)
 *   shopify – Shopify product export JSON (expands product × variant rows)
 *
 * All parsers return { headers, rows, totalRows } where every row is a
 * flat Record<string, string> suitable for the import engine.
 */

import { XMLParser } from "fast-xml-parser";
import { bufferToCsvText, parseCsv } from "./csv";
import type { FeedFormat } from "@workspace/db";

export type { FeedFormat };

export type ParsedFeed = {
  headers: string[];
  rows: Record<string, string>[];
  totalRows: number;
};

// ─── Flattener ────────────────────────────────────────────────────────────────

/**
 * Recursively flatten a JS value into a flat string map using dot notation.
 *
 * Arrays of primitives   →  joined with ","  (e.g. tags: ["a","b"] → "a,b")
 * Arrays of objects      →  expanded with index (e.g. variants.0.sku)
 * Nested objects         →  dot-joined keys (e.g. image.src)
 */
function flattenValue(obj: unknown, prefix = "", out: Record<string, string> = {}): void {
  if (obj === null || obj === undefined) {
    if (prefix) out[prefix] = "";
    return;
  }

  if (typeof obj !== "object") {
    if (prefix) out[prefix] = String(obj);
    return;
  }

  if (Array.isArray(obj)) {
    if (obj.length === 0) {
      if (prefix) out[prefix] = "";
      return;
    }
    const allPrimitive = obj.every((v) => v === null || typeof v !== "object");
    if (allPrimitive) {
      if (prefix) out[prefix] = obj.map((v) => (v === null ? "" : String(v))).join(",");
      return;
    }
    obj.forEach((item, i) => {
      flattenValue(item, prefix ? `${prefix}.${i}` : String(i), out);
    });
    return;
  }

  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    flattenValue(v, prefix ? `${prefix}.${k}` : k, out);
  }
}

function flatten(obj: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  flattenValue(obj, "", out);
  return out;
}

// ─── Array-finder ─────────────────────────────────────────────────────────────

const CANDIDATE_KEYS = ["products", "data", "items", "rows", "records", "feed", "catalog", "results"];

/**
 * Given an object, find the value that looks like a non-empty collection of records
 * (an array whose elements are objects with scalar values). Returns null if none found.
 */
function findNestedRecordArray(obj: Record<string, unknown>): unknown[] | null {
  let best: unknown[] | null = null;
  // Prefer well-known collection key names
  for (const key of CANDIDATE_KEYS) {
    const val = obj[key];
    if (Array.isArray(val) && val.length > 0 &&
        (val as unknown[]).some((v) => v !== null && typeof v === "object" && !Array.isArray(v))) {
      return val as unknown[];
    }
  }
  // Fall back: any key whose value is an array of objects
  for (const val of Object.values(obj)) {
    if (Array.isArray(val) && val.length > 0 &&
        (val as unknown[]).some((v) => v !== null && typeof v === "object" && !Array.isArray(v))) {
      if (!best || (val as unknown[]).length > best.length) best = val as unknown[];
    }
  }
  return best;
}

/**
 * Given a candidate array, unwrap it if it is a single-element "container" array
 * (i.e. the XML isArray config wrapped the root container element in an array and
 * the sole item inside holds the real record collection).
 *
 * Examples that get unwrapped:
 *   [{ product: [{sku:"A"}, {sku:"B"}] }]  →  [{sku:"A"}, {sku:"B"}]
 * Examples that are left alone:
 *   [{sku:"A"}, {sku:"B"}]   → unchanged (already records)
 *   [{sku:"A"}]              → unchanged (single record, no nested collection)
 */
function resolveArray(arr: unknown[]): unknown[] {
  if (arr.length === 1 &&
      arr[0] !== null &&
      typeof arr[0] === "object" &&
      !Array.isArray(arr[0])) {
    const nested = findNestedRecordArray(arr[0] as Record<string, unknown>);
    if (nested) return nested;
  }
  return arr;
}

/**
 * Given a parsed JSON/XML value, find the array of records to import.
 *
 * When the XML parser uses `isArray` for all non-leaf elements, elements like
 * `<catalog>` become 1-element wrapper arrays `[{ product: [{...},{...}] }]`.
 * `resolveArray` is called on every candidate array so these wrappers are
 * transparently unwrapped before being returned.
 *
 * Returns an empty array if nothing useful is found.
 */
function findRecordArray(data: unknown): unknown[] {
  if (Array.isArray(data)) {
    return resolveArray(data);
  }

  if (!data || typeof data !== "object") return [];

  const obj = data as Record<string, unknown>;

  // Prefer well-known keys first
  for (const key of CANDIDATE_KEYS) {
    if (Array.isArray(obj[key]) && (obj[key] as unknown[]).length > 0) {
      return resolveArray(obj[key] as unknown[]);
    }
  }

  // Fall back: any key whose value is a non-empty array
  for (const val of Object.values(obj)) {
    if (Array.isArray(val) && val.length > 0) return resolveArray(val as unknown[]);
  }

  // Nothing found — treat root as a single-record array
  return [data];
}

// ─── Parsers ──────────────────────────────────────────────────────────────────

function parseJsonFeed(buf: Buffer, maxRows?: number): ParsedFeed {
  let data: unknown;
  try {
    data = JSON.parse(buf.toString("utf8")) as unknown;
  } catch (e) {
    throw new Error(`Invalid JSON feed: ${e instanceof Error ? e.message : String(e)}`);
  }

  const records = findRecordArray(data);
  const totalRows = records.length;

  const limit = maxRows ?? Infinity;
  const rows: Record<string, string>[] = [];
  for (let i = 0; i < Math.min(records.length, limit); i++) {
    rows.push(flatten(records[i]));
  }

  const headerSet = new Set<string>();
  for (const row of rows) {
    for (const k of Object.keys(row)) headerSet.add(k);
  }
  const headers = Array.from(headerSet);

  return { headers, rows, totalRows };
}

function parseXmlFeed(buf: Buffer, maxRows?: number): ParsedFeed {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "",
    isArray: (_name, _jpath, isLeafNode, isAttribute) => !isLeafNode && !isAttribute,
    parseTagValue: true,
    parseAttributeValue: false,
    trimValues: true,
  });

  let parsed: unknown;
  try {
    parsed = parser.parse(buf.toString("utf8")) as unknown;
  } catch (e) {
    throw new Error(`Invalid XML feed: ${e instanceof Error ? e.message : String(e)}`);
  }

  // XMLParser wraps everything in the root element; peel it off
  if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
    const keys = Object.keys(parsed as Record<string, unknown>);
    if (keys.length === 1) {
      parsed = (parsed as Record<string, unknown>)[keys[0]];
    }
  }

  const records = findRecordArray(parsed);
  const totalRows = records.length;

  const limit = maxRows ?? Infinity;
  const rows: Record<string, string>[] = [];
  for (let i = 0; i < Math.min(records.length, limit); i++) {
    rows.push(flatten(records[i]));
  }

  const headerSet = new Set<string>();
  for (const row of rows) {
    for (const k of Object.keys(row)) headerSet.add(k);
  }
  const headers = Array.from(headerSet);

  return { headers, rows, totalRows };
}

/**
 * Shopify product export JSON expands each product × variant into one row.
 *
 * Product-level fields are included as-is (title, body_html, vendor, …).
 * Variant fields are prefixed with "variants." (variants.sku, variants.price, …).
 * The first image src is included as "images.src".
 */
function parseShopifyFeed(buf: Buffer, maxRows?: number): ParsedFeed {
  let data: unknown;
  try {
    data = JSON.parse(buf.toString("utf8")) as unknown;
  } catch (e) {
    throw new Error(`Invalid Shopify JSON: ${e instanceof Error ? e.message : String(e)}`);
  }

  type ShopifyVariant = Record<string, unknown>;
  type ShopifyImage = { src?: string };
  type ShopifyProduct = {
    title?: string;
    body_html?: string;
    vendor?: string;
    product_type?: string;
    handle?: string;
    tags?: string | string[];
    variants?: ShopifyVariant[];
    images?: ShopifyImage[];
    [key: string]: unknown;
  };

  const products = (
    Array.isArray(data)
      ? data
      : Array.isArray((data as Record<string, unknown>)?.products)
        ? ((data as Record<string, unknown>).products as unknown[])
        : [data]
  ) as ShopifyProduct[];

  // Pre-count total rows (products × variants) before applying maxRows cap.
  let totalRows = 0;
  for (const product of products) {
    const variantCount = product.variants && product.variants.length > 0 ? product.variants.length : 1;
    totalRows += variantCount;
  }

  const expanded: Record<string, string>[] = [];

  for (const product of products) {
    const productBase: Record<string, string> = {};
    // Scalar product fields
    const scalarKeys = ["title", "body_html", "vendor", "product_type", "handle"] as const;
    for (const k of scalarKeys) {
      productBase[k] = product[k] != null ? String(product[k]) : "";
    }
    // Tags (string or array)
    if (Array.isArray(product.tags)) {
      productBase["tags"] = product.tags.join(",");
    } else if (product.tags != null) {
      productBase["tags"] = String(product.tags);
    } else {
      productBase["tags"] = "";
    }
    // First image
    const firstImage = product.images?.[0];
    productBase["images.src"] = firstImage?.src ?? "";

    const variants = product.variants && product.variants.length > 0 ? product.variants : [{}];

    for (const variant of variants) {
      const row: Record<string, string> = { ...productBase };
      const flatVariant = flatten(variant);
      for (const [k, v] of Object.entries(flatVariant)) {
        row[`variants.${k}`] = v;
      }
      expanded.push(row);
      if (maxRows && expanded.length >= maxRows) break;
    }
    if (maxRows && expanded.length >= maxRows) break;
  }

  const headerSet = new Set<string>();
  for (const row of expanded) {
    for (const k of Object.keys(row)) headerSet.add(k);
  }
  const headers = Array.from(headerSet);

  return { headers, rows: expanded, totalRows };
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function parseFeed(
  buf: Buffer,
  format: FeedFormat,
  opts: { maxRows?: number } = {},
): ParsedFeed {
  switch (format) {
    case "csv": {
      const text = bufferToCsvText(buf);
      const { headers, rows } = parseCsv(text, { maxRows: opts.maxRows });
      const totalRows = Math.max(
        0,
        text.split(/\r\n|\n|\r/).filter((l) => l.trim() !== "").length - 1,
      );
      return { headers, rows, totalRows };
    }
    case "json":
      return parseJsonFeed(buf, opts.maxRows);
    case "xml":
      return parseXmlFeed(buf, opts.maxRows);
    case "shopify":
      return parseShopifyFeed(buf, opts.maxRows);
    default: {
      const exhaustive: never = format;
      throw new Error(`Unsupported feed format: ${String(exhaustive)}`);
    }
  }
}
