import { db, settingsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "./logger";

export const ADMIN_EMAIL_FALLBACK =
  process.env.ADMIN_EMAIL ?? "admin@cloudvape.store";

export const SITE_URL_FALLBACK =
  process.env.SITE_URL ?? "https://cloudvape.store";

export async function getSiteUrl(): Promise<string> {
  try {
    const [row] = await db
      .select()
      .from(settingsTable)
      .where(eq(settingsTable.key, "site_url"))
      .limit(1);
    if (row?.value) return row.value;
  } catch (err) {
    logger.warn({ err }, "config: failed to read site_url from settings — using fallback");
  }
  return SITE_URL_FALLBACK;
}
