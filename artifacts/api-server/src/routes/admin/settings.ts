import { Router, type IRouter } from "express";
import { db, settingsTable } from "@workspace/db";
import { z } from "zod";
import { ADMIN_EMAIL_FALLBACK, SITE_URL_FALLBACK } from "../../lib/config";

const router: IRouter = Router();

router.get("/admin/settings", async (_req, res): Promise<void> => {
  const rows = await db.select().from(settingsTable);
  const kv: Record<string, string> = {};
  for (const row of rows) {
    kv[row.key] = row.value;
  }

  const savedEmail = kv["alert_email"];
  const savedSiteUrl = kv["site_url"];

  res.json({
    ...kv,
    alert_email_effective: savedEmail ?? ADMIN_EMAIL_FALLBACK,
    alert_email_is_default: !savedEmail,
    site_url_effective: savedSiteUrl ?? SITE_URL_FALLBACK,
    site_url_is_default: !savedSiteUrl,
  });
});

const UpdateSettingsBody = z.object({
  alertEmail: z.string().email({ message: "Must be a valid email address" }).optional(),
  siteUrl: z
    .string()
    .url({ message: "Must be a valid URL" })
    .optional(),
});

router.put("/admin/settings", async (req, res): Promise<void> => {
  const parsed = UpdateSettingsBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid request" });
    return;
  }

  const { alertEmail, siteUrl } = parsed.data;

  if (!alertEmail && !siteUrl) {
    res.status(400).json({ error: "At least one setting must be provided" });
    return;
  }

  const upserts: Promise<unknown>[] = [];

  if (alertEmail) {
    upserts.push(
      db
        .insert(settingsTable)
        .values({ key: "alert_email", value: alertEmail })
        .onConflictDoUpdate({
          target: settingsTable.key,
          set: { value: alertEmail, updatedAt: new Date() },
        }),
    );
  }

  if (siteUrl) {
    upserts.push(
      db
        .insert(settingsTable)
        .values({ key: "site_url", value: siteUrl })
        .onConflictDoUpdate({
          target: settingsTable.key,
          set: { value: siteUrl, updatedAt: new Date() },
        }),
    );
  }

  await Promise.all(upserts);
  res.json({ alertEmail, siteUrl });
});

export default router;
