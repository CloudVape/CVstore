/**
 * Tabular feed parser. Primary format is RFC-4180-ish CSV; XLSX (Excel) is
 * supported by reading the first sheet and converting it to CSV via SheetJS.
 *
 * CSV supports: quoted fields, escaped quotes (""), commas in quotes,
 * newlines inside quoted fields, CRLF and LF line endings, BOM stripping.
 * Does not support: alternate delimiters (always `,`), comments, escape chars
 * other than doubled-quotes.
 */

import * as XLSX from "xlsx";

export type CsvRow = Record<string, string>;
export type CsvParseResult = {
  headers: string[];
  rows: CsvRow[];
};

const XLSX_MAGIC = Buffer.from([0x50, 0x4b, 0x03, 0x04]); // PK zip
const OLE_MAGIC = Buffer.from([0xd0, 0xcf, 0x11, 0xe0]); // legacy .xls

export function isXlsxBuffer(buf: Buffer): boolean {
  if (!Buffer.isBuffer(buf) || buf.length < 4) return false;
  return (
    buf.subarray(0, 4).equals(XLSX_MAGIC) ||
    buf.subarray(0, 4).equals(OLE_MAGIC)
  );
}

/**
 * Convert an XLSX/XLS buffer to a CSV string. Uses the first sheet only.
 */
export function xlsxBufferToCsv(buf: Buffer): string {
  const wb = XLSX.read(buf, { type: "buffer" });
  const firstName = wb.SheetNames[0];
  if (!firstName) return "";
  const sheet = wb.Sheets[firstName];
  return XLSX.utils.sheet_to_csv(sheet, { blankrows: false });
}

/**
 * Auto-detect format. If the buffer looks like an Excel file, convert it.
 * Otherwise treat the bytes as UTF-8 CSV text.
 */
export function bufferToCsvText(buf: Buffer): string {
  if (isXlsxBuffer(buf)) {
    return xlsxBufferToCsv(buf);
  }
  return buf.toString("utf8");
}

function stripBom(s: string): string {
  return s.charCodeAt(0) === 0xfeff ? s.slice(1) : s;
}

function parseCells(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;
  let i = 0;
  const n = text.length;

  while (i < n) {
    const ch = text[i];

    if (inQuotes) {
      if (ch === '"') {
        if (i + 1 < n && text[i + 1] === '"') {
          cell += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i++;
        continue;
      }
      cell += ch;
      i++;
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
      i++;
      continue;
    }
    if (ch === ",") {
      row.push(cell);
      cell = "";
      i++;
      continue;
    }
    if (ch === "\r") {
      // CRLF or bare CR
      row.push(cell);
      cell = "";
      rows.push(row);
      row = [];
      i++;
      if (i < n && text[i] === "\n") i++;
      continue;
    }
    if (ch === "\n") {
      row.push(cell);
      cell = "";
      rows.push(row);
      row = [];
      i++;
      continue;
    }
    cell += ch;
    i++;
  }

  // Flush trailing cell/row (only if there's any content)
  if (cell.length > 0 || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }

  return rows;
}

export function parseCsv(input: string, opts: { maxRows?: number } = {}): CsvParseResult {
  const text = stripBom(input);
  if (text.trim() === "") return { headers: [], rows: [] };

  const cells = parseCells(text);
  if (cells.length === 0) return { headers: [], rows: [] };

  const headers = cells[0].map((h) => h.trim());
  const dataRows = cells.slice(1);

  const rows: CsvRow[] = [];
  const limit = opts.maxRows ?? Infinity;
  for (const r of dataRows) {
    // skip fully empty rows
    if (r.every((c) => c === "")) continue;
    const obj: CsvRow = {};
    for (let i = 0; i < headers.length; i++) {
      obj[headers[i]] = r[i] ?? "";
    }
    rows.push(obj);
    if (rows.length >= limit) break;
  }

  return { headers, rows };
}
