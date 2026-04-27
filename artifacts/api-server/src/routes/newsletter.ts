import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, newsletterSubscribersTable } from "@workspace/db";
import { randomBytes, createHmac } from "node:crypto";
import { sendEmail, fireAndForget } from "../lib/email";
import { newsletterConfirmTemplate } from "../lib/email-templates";
import { z } from "zod";

const router: IRouter = Router();

const SITE_URL = process.env.SITE_URL ?? "https://vapevault.com";

function generateToken(): string {
  return randomBytes(32).toString("base64url");
}

const SubscribeBody = z.object({
  email: z.string().email(),
});

router.post("/newsletter/subscribe", async (req, res): Promise<void> => {
  const parsed = SubscribeBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Valid email required" });
    return;
  }
  const { email } = parsed.data;

  const existing = await db
    .select()
    .from(newsletterSubscribersTable)
    .where(eq(newsletterSubscribersTable.email, email));

  if (existing.length > 0) {
    const sub = existing[0];
    if (sub.status === "confirmed") {
      res.json({ message: "Already subscribed" });
      return;
    }
    const confirmUrl = `${SITE_URL}/newsletter/confirm?token=${sub.token}`;
    const tpl = newsletterConfirmTemplate({ confirmUrl });
    fireAndForget(sendEmail({ ...tpl, to: email, template: "newsletter-confirm" }));
    res.json({ message: "Confirmation email resent" });
    return;
  }

  const token = generateToken();
  await db.insert(newsletterSubscribersTable).values({ email, token, status: "pending" });

  const confirmUrl = `${SITE_URL}/newsletter/confirm?token=${token}`;
  const tpl = newsletterConfirmTemplate({ confirmUrl });
  fireAndForget(sendEmail({ ...tpl, to: email, template: "newsletter-confirm" }));

  res.status(201).json({ message: "Check your email to confirm your subscription" });
});

router.get("/newsletter/confirm", async (req, res): Promise<void> => {
  const token = typeof req.query.token === "string" ? req.query.token : "";
  if (!token) {
    res.status(400).json({ error: "Missing token" });
    return;
  }
  const [sub] = await db
    .select()
    .from(newsletterSubscribersTable)
    .where(eq(newsletterSubscribersTable.token, token));
  if (!sub) {
    res.status(404).json({ error: "Invalid or expired token" });
    return;
  }
  if (sub.status === "confirmed") {
    res.json({ message: "Already confirmed" });
    return;
  }
  await db
    .update(newsletterSubscribersTable)
    .set({ status: "confirmed", subscribedAt: new Date() })
    .where(eq(newsletterSubscribersTable.id, sub.id));

  res.json({ message: "Subscription confirmed! Welcome to VapeVault drops & deals." });
});

router.get("/newsletter/unsubscribe", async (req, res): Promise<void> => {
  const token = typeof req.query.token === "string" ? req.query.token : "";
  if (!token) {
    res.status(400).json({ error: "Missing token" });
    return;
  }
  const [sub] = await db
    .select()
    .from(newsletterSubscribersTable)
    .where(eq(newsletterSubscribersTable.token, token));
  if (!sub) {
    res.status(404).json({ error: "Invalid token" });
    return;
  }
  await db
    .update(newsletterSubscribersTable)
    .set({ status: "unsubscribed", unsubscribedAt: new Date() })
    .where(eq(newsletterSubscribersTable.id, sub.id));

  res.json({ message: "You have been unsubscribed from VapeVault marketing emails." });
});

export default router;
