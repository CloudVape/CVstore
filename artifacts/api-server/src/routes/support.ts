import { Router, type IRouter } from "express";
import { eq, desc, ilike, or, and } from "drizzle-orm";
import { z } from "zod/v4";
import {
  db,
  supportTicketsTable,
  supportMessagesTable,
  helpArticlesTable,
  helpCategoriesTable,
  ordersTable,
} from "@workspace/db";
import { sendEmail, fireAndForget } from "../lib/email";
import { ticketConfirmationTemplate, ticketReplyTemplate } from "../lib/email-templates";
import { getSiteUrl } from "../lib/config";
import { logger } from "../lib/logger";

/** Parse an RFC 5321 address that may arrive as "Name <addr>" or plain "addr". */
function parseEmailAddress(raw: string): { email: string; name: string | undefined } {
  const angleMatch = /^(.+?)\s*<([^>]+)>\s*$/.exec(raw);
  if (angleMatch) {
    return {
      name: angleMatch[1].trim().replace(/^["']|["']$/g, "") || undefined,
      email: angleMatch[2].trim().toLowerCase(),
    };
  }
  return { email: raw.trim().toLowerCase(), name: undefined };
}

const router: IRouter = Router();

const ContactBody = z.object({
  customerName: z.string().min(1).max(200),
  customerEmail: z.string().email(),
  orderNumber: z.string().optional(),
  category: z.enum(["orders", "returns", "product", "account", "other"]),
  message: z.string().min(10).max(5000),
});

router.post("/support/tickets", async (req, res): Promise<void> => {
  const parsed = ContactBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid contact form", details: parsed.error.message });
    return;
  }
  const { customerName, customerEmail, orderNumber, category, message } = parsed.data;

  try {
    const [ticket] = await db
      .insert(supportTicketsTable)
      .values({ customerName, customerEmail, orderNumber: orderNumber ?? null, category, status: "open" })
      .returning();

    await db.insert(supportMessagesTable).values({
      ticketId: ticket.id,
      authorType: "customer",
      body: message,
    });

    const siteUrl = await getSiteUrl();
    const tpl = ticketConfirmationTemplate({
      customerName,
      ticketId: ticket.id,
      category: CATEGORY_LABELS[category] ?? category,
      siteUrl,
    });
    fireAndForget(sendEmail({ ...tpl, to: customerEmail, template: "support-ticket-confirmation" }));

    fireAndForget(runAiAutoReply(ticket.id));

    res.status(201).json({ ticketId: ticket.id });
  } catch (err) {
    req.log?.error?.({ err }, "create ticket failed");
    res.status(500).json({ error: "Failed to create support ticket" });
  }
});

const WEBHOOK_SECRET = process.env.SUPPORT_WEBHOOK_SECRET;
const IS_PROD = process.env.NODE_ENV === "production";

/**
 * Parse and process a raw inbound-email payload (Resend webhook format or flat).
 * Exported so the admin test endpoint can exercise the same logic.
 */
async function processInboundEmailPayload(rawBody: Record<string, unknown>): Promise<{ ticketId: number }> {
  // Resend inbound email webhook wraps payload under a "data" key:
  // { type: "email.received", created_at: "...", data: { from, to, subject, html, text, ... } }
  // Fall back to reading fields from the top level for direct/testing calls.
  const payload = (rawBody.type === "email.received" && rawBody.data && typeof rawBody.data === "object")
    ? (rawBody.data as Record<string, unknown>)
    : rawBody;

  const from = typeof payload.from === "string" ? payload.from : undefined;
  const fromName = typeof payload.fromName === "string" ? payload.fromName : undefined;
  const subject = typeof payload.subject === "string" ? payload.subject : undefined;
  const text = typeof payload.text === "string" ? payload.text : undefined;
  const html = typeof payload.html === "string" ? payload.html : undefined;

  if (!from || (!text && !html)) {
    throw Object.assign(new Error("Missing required fields: from, text or html"), { statusCode: 400 });
  }

  const parsedFrom = parseEmailAddress(from.trim());
  const customerEmail = parsedFrom.email;
  const customerName = fromName?.trim() || parsedFrom.name || customerEmail.split("@")[0];
  const body = (text || html || "").trim();

  let ticketId: number;

  const ticketIdMatch = /\[#(\d+)\]/.exec(subject ?? "");
  if (ticketIdMatch) {
    const existingId = parseInt(ticketIdMatch[1], 10);
    const [existing] = await db
      .select()
      .from(supportTicketsTable)
      .where(eq(supportTicketsTable.id, existingId));
    if (existing) {
      ticketId = existing.id;
      await db.insert(supportMessagesTable).values({ ticketId, authorType: "customer", body });
      await db.update(supportTicketsTable)
        .set({ status: "open", updatedAt: new Date() })
        .where(eq(supportTicketsTable.id, ticketId));
    } else {
      ticketId = await createNewTicket(customerEmail, customerName, body);
    }
  } else {
    const [recent] = await db
      .select()
      .from(supportTicketsTable)
      .where(and(eq(supportTicketsTable.customerEmail, customerEmail), eq(supportTicketsTable.status, "open")))
      .orderBy(desc(supportTicketsTable.createdAt))
      .limit(1);

    if (recent) {
      ticketId = recent.id;
      await db.insert(supportMessagesTable).values({ ticketId, authorType: "customer", body });
    } else {
      ticketId = await createNewTicket(customerEmail, customerName, body);
    }
  }

  fireAndForget(runAiAutoReply(ticketId));
  return { ticketId };
}

router.post("/support/inbound-email", async (req, res): Promise<void> => {
  if (!WEBHOOK_SECRET && IS_PROD) {
    logger.error("SUPPORT_WEBHOOK_SECRET env var is not set — inbound-email endpoint is disabled in production");
    res.status(503).json({ error: "Inbound email endpoint is not configured" });
    return;
  }

  if (WEBHOOK_SECRET) {
    // Accept the secret via header (for direct API callers) or query param
    // (for Resend inbound routing, which doesn't support custom headers —
    //  configure the webhook URL in Resend as:
    //    https://yoursite.com/api/support/inbound-email?secret=<SUPPORT_WEBHOOK_SECRET>)
    const provided =
      req.header("x-webhook-secret") ??
      req.header("x-support-secret") ??
      (typeof req.query.secret === "string" ? req.query.secret : "") ??
      "";
    if (!provided || provided !== WEBHOOK_SECRET) {
      res.status(401).json({ error: "Unauthorized: invalid webhook secret" });
      return;
    }
  } else {
    logger.warn("SUPPORT_WEBHOOK_SECRET not set — running in development mode without webhook authentication");
  }

  try {
    const result = await processInboundEmailPayload(req.body as Record<string, unknown>);
    res.json(result);
  } catch (err) {
    const statusCode = (err as { statusCode?: number }).statusCode;
    if (statusCode === 400) {
      res.status(400).json({ error: (err as Error).message });
      return;
    }
    req.log?.error?.({ err }, "inbound email processing failed");
    res.status(500).json({ error: "Inbound email processing failed" });
  }
});

async function createNewTicket(customerEmail: string, customerName: string, body: string): Promise<number> {
  const [ticket] = await db
    .insert(supportTicketsTable)
    .values({ customerEmail, customerName, category: "other", status: "open" })
    .returning();
  await db.insert(supportMessagesTable).values({ ticketId: ticket.id, authorType: "customer", body });
  return ticket.id;
}

async function runAiAutoReply(ticketId: number): Promise<void> {
  try {
    const [ticket] = await db.select().from(supportTicketsTable).where(eq(supportTicketsTable.id, ticketId));
    if (!ticket) return;

    const messages = await db
      .select()
      .from(supportMessagesTable)
      .where(eq(supportMessagesTable.ticketId, ticketId))
      .orderBy(supportMessagesTable.createdAt);

    const thread = messages
      .map((m) => `[${m.authorType.toUpperCase()}]: ${m.body}`)
      .join("\n\n---\n\n");

    const lastMessage = messages[messages.length - 1]?.body ?? "";
    const keywords = lastMessage.split(/\s+/).filter((w) => w.length > 4).slice(0, 10);
    const searchClause = keywords.length > 0
      ? or(...keywords.map((kw) => or(ilike(helpArticlesTable.title, `%${kw}%`), ilike(helpArticlesTable.body, `%${kw}%`))))
      : undefined;

    const articles = searchClause
      ? await db
          .select({ title: helpArticlesTable.title, body: helpArticlesTable.body })
          .from(helpArticlesTable)
          .where(and(eq(helpArticlesTable.published, true), searchClause))
          .limit(5)
      : [];

    const orders = await db
      .select({ orderNumber: ordersTable.orderNumber, status: ordersTable.status, createdAt: ordersTable.createdAt, totalCents: ordersTable.totalCents })
      .from(ordersTable)
      .where(eq(ordersTable.email, ticket.customerEmail))
      .orderBy(desc(ordersTable.createdAt))
      .limit(3);

    const articlesContext = articles.length > 0
      ? `\n\nRELEVANT HELP CENTER ARTICLES:\n${articles.map((a) => `--- ${a.title} ---\n${a.body}`).join("\n\n")}`
      : "";

    const ordersContext = orders.length > 0
      ? `\n\nCUSTOMER ORDERS:\n${orders.map((o) => `Order ${o.orderNumber}: ${o.status}, $${(o.totalCents / 100).toFixed(2)}, placed ${new Date(o.createdAt).toLocaleDateString()}`).join("\n")}`
      : "";

    const systemPrompt = `You are a helpful customer support agent for CloudVape, an online vape shop. You answer customer questions professionally, clearly, and concisely. You are knowledgeable about vaping products, shipping policies, and account issues.

CloudVape policies:
- Free shipping on orders over $50
- Returns accepted within 30 days for unopened items
- Age verification required (21+)
- Ships to all US states except where prohibited
- Orders typically ship within 1-2 business days${articlesContext}${ordersContext}

Respond with a JSON object containing:
- "reply": the reply text to send to the customer (plain text, no markdown)
- "confident": true if you are confident this reply fully resolves the issue, false if it needs human review
- "reason": brief explanation of your confidence level`;

    const { openai } = await import("@workspace/integrations-openai-ai-server");
    const completion = await openai.chat.completions.create({
      model: "gpt-5-mini",
      max_completion_tokens: 1024,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: `SUPPORT THREAD:\n${thread}\n\nPlease draft a reply to the customer's most recent message.` },
      ],
      response_format: { type: "json_object" },
    });

    const responseText = completion.choices[0]?.message?.content ?? "{}";
    let parsed: { reply?: string; confident?: boolean; reason?: string } = {};
    try {
      parsed = JSON.parse(responseText);
    } catch {
      logger.warn({ ticketId }, "AI response was not valid JSON");
    }

    const reply = parsed.reply?.trim() ?? "";
    const confident = parsed.confident === true && reply.length > 20;

    if (!reply) {
      await db.update(supportTicketsTable)
        .set({ status: "needs_human", aiDraft: null, aiConfident: false, updatedAt: new Date() })
        .where(eq(supportTicketsTable.id, ticketId));
      return;
    }

    await db.update(supportTicketsTable)
      .set({ aiDraft: reply, aiConfident: confident, status: confident ? "awaiting_customer" : "needs_human", updatedAt: new Date() })
      .where(eq(supportTicketsTable.id, ticketId));

    if (confident) {
      await db.insert(supportMessagesTable).values({ ticketId, authorType: "ai", body: reply });
      const siteUrl = await getSiteUrl();
      const tpl = ticketReplyTemplate({ customerName: ticket.customerName, ticketId: ticket.id, replyBody: reply, siteUrl });
      await sendEmail({ ...tpl, to: ticket.customerEmail, template: "support-reply" });
    }
  } catch (err) {
    logger.error({ err, ticketId }, "AI auto-reply failed");
    await db.update(supportTicketsTable)
      .set({ status: "needs_human", updatedAt: new Date() })
      .where(eq(supportTicketsTable.id, ticketId));
  }
}

const CATEGORY_LABELS: Record<string, string> = {
  orders: "Orders & Shipping",
  returns: "Returns & Refunds",
  product: "Product Questions",
  account: "Account",
  other: "Other",
};

export { runAiAutoReply, processInboundEmailPayload };
export default router;
