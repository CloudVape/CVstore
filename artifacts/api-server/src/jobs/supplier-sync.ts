import { db, suppliersTable, importRunsTable, settingsTable, type SupplierSchedule } from "@workspace/db";
import { and, eq, isNotNull } from "drizzle-orm";
import { logger } from "../lib/logger";
import { fetchFeedFromUrl } from "../lib/fetch-feed";
import { parseCsv, bufferToCsvText } from "../lib/csv";
import { executeImportRun } from "../lib/import-engine";
import { sendEmail, fireAndForget } from "../lib/email";
import { supplierSyncFailureTemplate } from "../lib/email-templates";

const ADMIN_EMAIL_FALLBACK = process.env.ADMIN_EMAIL ?? "admin@cloudvape.store";
const ADMIN_SITE_URL = process.env.SITE_URL ?? "https://cloudvape.store";

async function getAdminAlertEmail(): Promise<string> {
  try {
    const [row] = await db
      .select()
      .from(settingsTable)
      .where(eq(settingsTable.key, "alert_email"))
      .limit(1);
    if (row?.value) return row.value;
  } catch (err) {
    logger.warn({ err }, "supplier-sync: failed to read alert_email from settings — using fallback");
  }
  return ADMIN_EMAIL_FALLBACK;
}

const CHECK_INTERVAL_MS = 60_000;
const ALERT_COOLDOWN_MS = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Minimum elapsed time before a supplier is considered "due" again.
 * We use slightly less than the full interval so daily/weekly jobs
 * don't slip by one minute each cycle.
 */
const MIN_ELAPSED_MS: Record<
  Exclude<NonNullable<SupplierSchedule>["frequency"], "manual">,
  number
> = {
  hourly: 60 * 60 * 1000,
  daily: 23 * 60 * 60 * 1000,
  weekly: 6.5 * 24 * 60 * 60 * 1000,
};

const runningSuppliers = new Set<number>();

/**
 * Returns true when a supplier's scheduled import is due to run.
 * For daily/weekly schedules with an hourOfDay configured, the run
 * is also gated to the matching UTC hour so jobs don't fire at
 * arbitrary times.
 */
function isDue(schedule: SupplierSchedule, lastRunAt: Date | null): boolean {
  if (!schedule.enabled) return false;
  if (schedule.frequency === "manual") return false;

  const now = new Date();
  const elapsedMs = lastRunAt ? now.getTime() - lastRunAt.getTime() : Infinity;
  const minMs = MIN_ELAPSED_MS[schedule.frequency];

  if (elapsedMs < minMs) return false;

  // For hourly: interval check is sufficient.
  if (schedule.frequency === "hourly") return true;

  // For daily/weekly: if the admin configured a specific hour, only fire
  // during that UTC hour so the job runs at a predictable time of day.
  if (schedule.hourOfDay !== null && schedule.hourOfDay !== undefined) {
    return now.getUTCHours() === schedule.hourOfDay;
  }

  return true;
}

/**
 * Creates a failed import_run record for errors that occur before
 * executeImportRun is called (i.e. feed fetch or CSV parse failures).
 */
async function recordPreRunFailure(
  supplierId: number,
  sourceUrl: string,
  error: unknown,
): Promise<void> {
  const now = new Date();
  try {
    await db.insert(importRunsTable).values({
      supplierId,
      triggeredByUserId: null,
      status: "failed",
      source: "csv-url",
      sourceUrl,
      totalRows: 0,
      errorMessage: error instanceof Error ? error.message : String(error),
      finishedAt: now,
    });
    await db
      .update(suppliersTable)
      .set({ lastRunAt: now })
      .where(eq(suppliersTable.id, supplierId));
  } catch (dbErr) {
    logger.error({ supplierId, dbErr }, "supplier-sync: failed to persist pre-run failure");
  }
}

async function runScheduledSuppliers(): Promise<void> {
  let suppliers: (typeof suppliersTable.$inferSelect)[];
  try {
    suppliers = await db
      .select()
      .from(suppliersTable)
      .where(
        and(
          eq(suppliersTable.sourceType, "csv-url"),
          isNotNull(suppliersTable.sourceUrl),
        ),
      );
  } catch (err) {
    logger.error({ err }, "supplier-sync: failed to query suppliers");
    return;
  }

  for (const supplier of suppliers) {
    const schedule = supplier.schedule;
    if (!schedule || !isDue(schedule, supplier.lastRunAt)) continue;
    if (runningSuppliers.has(supplier.id)) continue;

    const mapping = supplier.columnMapping;
    if (!mapping || Object.keys(mapping).length === 0) {
      logger.warn(
        { supplierId: supplier.id, name: supplier.name },
        "supplier-sync: skipping supplier with no column mapping",
      );
      continue;
    }

    runningSuppliers.add(supplier.id);
    logger.info(
      { supplierId: supplier.id, name: supplier.name, frequency: schedule.frequency },
      "supplier-sync: starting scheduled import",
    );

    (async (s: typeof supplier) => {
      let fetchAndParseDone = false;
      try {
        const buf = await fetchFeedFromUrl(s.sourceUrl!);
        const csvText = bufferToCsvText(buf);
        const { rows } = parseCsv(csvText);
        fetchAndParseDone = true;

        const { runId, result } = await executeImportRun({
          supplierId: s.id,
          triggeredByUserId: null,
          source: "csv-url",
          sourceUrl: s.sourceUrl,
          mapping: s.columnMapping,
          rows,
        });

        logger.info(
          {
            supplierId: s.id,
            name: s.name,
            runId,
            created: result.createdCount,
            updated: result.updatedCount,
            skipped: result.skippedCount,
            errored: result.erroredCount,
          },
          "supplier-sync: scheduled import completed",
        );
      } catch (err) {
        if (!fetchAndParseDone) {
          // Feed fetch or CSV parse failed before executeImportRun created
          // an import_runs row — persist the failure manually so it shows up
          // in Import History.
          await recordPreRunFailure(s.id, s.sourceUrl!, err);
        }
        // If fetchAndParseDone is true, executeImportRun already persisted the
        // failure and updated lastRunAt — nothing extra to do here.
        logger.error(
          { supplierId: s.id, name: s.name, err },
          "supplier-sync: scheduled import failed",
        );

        const now = new Date();
        const lastAlert = s.lastAlertSentAt ? s.lastAlertSentAt.getTime() : 0;
        const alertCooledDown = now.getTime() - lastAlert >= ALERT_COOLDOWN_MS;

        if (alertCooledDown) {
          const errorMessage = err instanceof Error ? err.message : String(err);
          const importHistoryUrl = `${ADMIN_SITE_URL}/admin/suppliers/${s.id}?tab=history`;
          const { subject, html, text } = supplierSyncFailureTemplate({
            supplierName: s.name,
            errorMessage,
            importHistoryUrl,
          });
          const alertEmail = await getAdminAlertEmail();
          fireAndForget(
            sendEmail({ to: alertEmail, subject, html, text, template: "supplier-sync-failure" }),
          );
          try {
            await db
              .update(suppliersTable)
              .set({ lastAlertSentAt: now })
              .where(eq(suppliersTable.id, s.id));
          } catch (dbErr) {
            logger.error({ supplierId: s.id, dbErr }, "supplier-sync: failed to update lastAlertSentAt");
          }
        } else {
          const cooldownRemainingMin = Math.ceil(
            (ALERT_COOLDOWN_MS - (now.getTime() - lastAlert)) / 60_000,
          );
          logger.info(
            { supplierId: s.id, name: s.name, cooldownRemainingMin },
            "supplier-sync: failure alert suppressed — within 24-hour cooldown window",
          );
        }
      } finally {
        runningSuppliers.delete(s.id);
      }
    })(supplier);
  }
}

export function startSupplierSyncJob(): void {
  logger.info("supplier-sync: scheduler started");
  setInterval(() => {
    runScheduledSuppliers().catch((err) => {
      logger.error({ err }, "supplier-sync: unexpected error in scheduler tick");
    });
  }, CHECK_INTERVAL_MS);
}
