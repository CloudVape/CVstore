import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, settingsTable } from "@workspace/db";
import { z } from "zod";

const router: IRouter = Router();

const ADMIN_EMAIL_FALLBACK = process.env.ADMIN_EMAIL ?? "admin@cloudvape.store";

router.get("/admin/settings", async (_req, res): Promise<void> => {
  const rows = await db.select().from(settingsTable);
  const result: Record<string, string> = {};
  for (const row of rows) {
    result[row.key] = row.value;
  }
  const savedEmail = result["alert_email"];
  result["alert_email_effective"] = savedEmail ?? ADMIN_EMAIL_FALLBACK;
  result["alert_email_is_default"] = savedEmail ? "false" : "true";
  res.json(result);
});

const UpdateSettingsBody = z.object({
  alertEmail: z.string().email({ message: "Must be a valid email address" }),
});

router.put("/admin/settings", async (req, res): Promise<void> => {
  const parsed = UpdateSettingsBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid request" });
    return;
  }

  const { alertEmail } = parsed.data;

  await db
    .insert(settingsTable)
    .values({ key: "alert_email", value: alertEmail })
    .onConflictDoUpdate({
      target: settingsTable.key,
      set: { value: alertEmail, updatedAt: new Date() },
    });

  res.json({ alertEmail });
});

export default router;
