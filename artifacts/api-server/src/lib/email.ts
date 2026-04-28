import { Resend } from "resend";
import { db, emailLogTable } from "@workspace/db";
import { and, desc, eq, inArray } from "drizzle-orm";
import { logger } from "./logger";

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const FROM_TRANSACTIONAL = process.env.FROM_EMAIL_TRANSACTIONAL ?? "CloudVape <support@cloudvape.store>";
const FROM_MARKETING = process.env.FROM_EMAIL_MARKETING ?? "CloudVape <hello@cloudvape.store>";
const FROM_NOREPLY = process.env.FROM_EMAIL_NOREPLY ?? "CloudVape <noreply@cloudvape.store>";
const REPLY_TO = process.env.REPLY_TO_EMAIL ?? undefined;

const MAX_RETRIES = 3;
const RETRY_BASE_MS = 1000;

let resend: Resend | null = null;
if (RESEND_API_KEY) {
  resend = new Resend(RESEND_API_KEY);
} else {
  logger.warn("RESEND_API_KEY not set — emails will be logged but not sent");
}

export type EmailTemplate =
  | "welcome"
  | "verify-email"
  | "password-reset"
  | "order-confirmation"
  | "shipping-update"
  | "delivery-confirmation"
  | "refund-confirmation"
  | "review-request"
  | "marketing-broadcast"
  | "newsletter-confirm"
  | "support-ticket-confirmation"
  | "support-reply"
  | "supplier-sync-failure";

export interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  text: string;
  template: EmailTemplate;
  marketing?: boolean;
  noreply?: boolean;
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function isSuppressed(email: string): Promise<boolean> {
  const rows = await db
    .select({ id: emailLogTable.id })
    .from(emailLogTable)
    .where(
      and(
        eq(emailLogTable.recipient, email),
        inArray(emailLogTable.status, ["bounced", "complained"])
      )
    )
    .limit(1);
  return rows.length > 0;
}

async function sendWithRetry(
  from: string,
  to: string,
  subject: string,
  html: string,
  text: string,
  replyTo?: string,
): Promise<string | null> {
  let lastError: Error | null = null;
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    if (attempt > 0) {
      await sleep(RETRY_BASE_MS * Math.pow(2, attempt - 1));
    }
    try {
      const { data, error } = await resend!.emails.send({
        from,
        to,
        subject,
        html,
        text,
        ...(replyTo ? { reply_to: replyTo } : {}),
      });
      if (error) throw new Error(error.message ?? "Resend API error");
      return data?.id ?? null;
    } catch (err: unknown) {
      lastError = err instanceof Error ? err : new Error(String(err));
      logger.warn({ attempt, to, err }, "email send attempt failed, will retry");
    }
  }
  throw lastError;
}

export async function sendEmail(opts: SendEmailOptions): Promise<void> {
  const from = opts.marketing ? FROM_MARKETING : opts.noreply ? FROM_NOREPLY : FROM_TRANSACTIONAL;

  const suppressed = await isSuppressed(opts.to);
  if (suppressed) {
    await db.insert(emailLogTable).values({
      recipient: opts.to,
      fromAddress: from,
      template: opts.template,
      subject: opts.subject,
      status: "suppressed",
      error: "Recipient has a prior bounce or complaint",
    });
    logger.info({ template: opts.template, to: opts.to }, "email suppressed (prior bounce/complaint)");
    return;
  }

  const [logRow] = await db
    .insert(emailLogTable)
    .values({
      recipient: opts.to,
      fromAddress: from,
      template: opts.template,
      subject: opts.subject,
      status: "pending",
    })
    .returning();

  if (!resend) {
    await db
      .update(emailLogTable)
      .set({ status: "skipped", error: "RESEND_API_KEY not configured", updatedAt: new Date() })
      .where(eq(emailLogTable.id, logRow.id));
    logger.info({ template: opts.template, to: opts.to }, "email skipped (no API key)");
    return;
  }

  try {
    const replyTo = opts.marketing ? REPLY_TO : undefined;
    const messageId = await sendWithRetry(from, opts.to, opts.subject, opts.html, opts.text, replyTo);
    await db
      .update(emailLogTable)
      .set({ status: "sent", providerMessageId: messageId, updatedAt: new Date() })
      .where(eq(emailLogTable.id, logRow.id));
    logger.info({ template: opts.template, to: opts.to, messageId }, "email sent");
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err);
    await db
      .update(emailLogTable)
      .set({ status: "failed", error: errMsg, updatedAt: new Date() })
      .where(eq(emailLogTable.id, logRow.id));
    logger.error({ template: opts.template, to: opts.to, err }, "email send failed after retries");
  }
}

export function fireAndForget(promise: Promise<void>): void {
  promise.catch((err: unknown) => logger.error({ err }, "background email error"));
}
