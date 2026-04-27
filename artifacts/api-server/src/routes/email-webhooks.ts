import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, emailLogTable } from "@workspace/db";
import { logger } from "../lib/logger";
import crypto from "node:crypto";

const router: IRouter = Router();

const RESEND_WEBHOOK_SECRET = process.env.RESEND_WEBHOOK_SECRET;

interface ResendWebhookEvent {
  type: string;
  data?: {
    email_id?: string;
  };
}

/**
 * Verify Svix-style webhook signature used by Resend.
 * Signed message format: `{svix-id}.{svix-timestamp}.{raw_body}`
 * Secret format: `whsec_<base64>` — strip prefix, base64-decode to get key bytes.
 * Signature header: `v1,<base64>` (space-separated, multiple sigs allowed).
 */
function verifySvixSignature(
  msgId: string,
  timestamp: string,
  rawBody: string,
  sigHeader: string,
  secret: string,
): boolean {
  try {
    const keyBytes = Buffer.from(secret.replace(/^whsec_/, ""), "base64");
    const toSign = `${msgId}.${timestamp}.${rawBody}`;
    const expected = crypto.createHmac("sha256", keyBytes).update(toSign).digest("base64");
    const sigs = sigHeader.split(" ").map((s) => s.replace(/^v1,/, ""));
    return sigs.some((sig) => {
      try {
        const sigBuf = Buffer.from(sig, "base64");
        const expBuf = Buffer.from(expected, "base64");
        return sigBuf.length === expBuf.length && crypto.timingSafeEqual(sigBuf, expBuf);
      } catch {
        return false;
      }
    });
  } catch {
    return false;
  }
}

router.post("/webhooks/resend", async (req, res): Promise<void> => {
  const rawBody = req.rawBody?.toString("utf8") ?? "";

  if (RESEND_WEBHOOK_SECRET) {
    const msgId = req.header("svix-id") ?? "";
    const timestamp = req.header("svix-timestamp") ?? "";
    const sigHeader = req.header("svix-signature") ?? "";
    if (!msgId || !timestamp || !sigHeader || !verifySvixSignature(msgId, timestamp, rawBody, sigHeader, RESEND_WEBHOOK_SECRET)) {
      res.status(401).json({ error: "Invalid webhook signature" });
      return;
    }
  }

  const event = req.body as ResendWebhookEvent;
  logger.info({ type: event.type }, "resend webhook received");

  const emailId = event.data?.email_id;
  if (!emailId) {
    res.json({ ok: true });
    return;
  }

  const STATUS_MAP: Record<string, string> = {
    "email.bounced": "bounced",
    "email.complained": "complained",
    "email.delivered": "delivered",
  };

  const newStatus = STATUS_MAP[event.type];
  if (newStatus) {
    try {
      await db
        .update(emailLogTable)
        .set({ status: newStatus, updatedAt: new Date() })
        .where(eq(emailLogTable.providerMessageId, emailId));
      logger.info({ emailId, status: newStatus }, "email log updated via webhook");
    } catch (err: unknown) {
      logger.error({ err, emailId }, "failed to update email log from webhook");
    }
  }

  res.json({ ok: true });
});

export default router;
