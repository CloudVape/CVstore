import { Router, type IRouter } from "express";
import { eq, desc, and } from "drizzle-orm";
import { z } from "zod/v4";
import { db, supportTicketsTable, supportMessagesTable } from "@workspace/db";
import { sendEmail, fireAndForget } from "../../lib/email";
import { ticketReplyTemplate } from "../../lib/email-templates";
import { runAiAutoReply } from "../support";
import { logger } from "../../lib/logger";

const router: IRouter = Router();

router.get("/admin/support/tickets", async (req, res): Promise<void> => {
  const status = typeof req.query.status === "string" ? req.query.status : "";
  const whereClause = status ? eq(supportTicketsTable.status, status) : undefined;

  const tickets = whereClause
    ? await db.select().from(supportTicketsTable).where(whereClause).orderBy(desc(supportTicketsTable.updatedAt))
    : await db.select().from(supportTicketsTable).orderBy(desc(supportTicketsTable.updatedAt));

  res.json(tickets);
});

router.get("/admin/support/tickets/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  const [ticket] = await db.select().from(supportTicketsTable).where(eq(supportTicketsTable.id, id));
  if (!ticket) { res.status(404).json({ error: "Ticket not found" }); return; }

  const messages = await db
    .select()
    .from(supportMessagesTable)
    .where(eq(supportMessagesTable.ticketId, id))
    .orderBy(supportMessagesTable.createdAt);

  res.json({ ...ticket, messages });
});

router.post("/admin/support/tickets/:id/reply", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  const Body = z.object({ body: z.string().min(1).max(10000) });
  const parsed = Body.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const [ticket] = await db.select().from(supportTicketsTable).where(eq(supportTicketsTable.id, id));
  if (!ticket) { res.status(404).json({ error: "Ticket not found" }); return; }

  await db.insert(supportMessagesTable).values({ ticketId: id, authorType: "human", body: parsed.data.body });
  await db.update(supportTicketsTable)
    .set({ status: "awaiting_customer", aiDraft: null, updatedAt: new Date() })
    .where(eq(supportTicketsTable.id, id));

  const tpl = ticketReplyTemplate({ customerName: ticket.customerName, ticketId: id, replyBody: parsed.data.body });
  fireAndForget(sendEmail({ ...tpl, to: ticket.customerEmail, template: "support-reply" }));

  res.json({ ok: true });
});

router.post("/admin/support/tickets/:id/send-draft", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  const Body = z.object({ body: z.string().min(1).max(10000) });
  const parsed = Body.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const [ticket] = await db.select().from(supportTicketsTable).where(eq(supportTicketsTable.id, id));
  if (!ticket) { res.status(404).json({ error: "Ticket not found" }); return; }

  await db.insert(supportMessagesTable).values({ ticketId: id, authorType: "ai", body: parsed.data.body });
  await db.update(supportTicketsTable)
    .set({ status: "awaiting_customer", aiDraft: null, aiConfident: null, updatedAt: new Date() })
    .where(eq(supportTicketsTable.id, id));

  const tpl = ticketReplyTemplate({ customerName: ticket.customerName, ticketId: id, replyBody: parsed.data.body });
  fireAndForget(sendEmail({ ...tpl, to: ticket.customerEmail, template: "support-reply" }));

  res.json({ ok: true });
});

router.patch("/admin/support/tickets/:id/status", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  const Body = z.object({ status: z.enum(["open", "needs_human", "awaiting_customer", "resolved"]) });
  const parsed = Body.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const [ticket] = await db
    .update(supportTicketsTable)
    .set({ status: parsed.data.status, updatedAt: new Date() })
    .where(eq(supportTicketsTable.id, id))
    .returning();
  if (!ticket) { res.status(404).json({ error: "Ticket not found" }); return; }
  res.json(ticket);
});

router.post("/admin/support/tickets/:id/retry-ai", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  const [ticket] = await db.select().from(supportTicketsTable).where(eq(supportTicketsTable.id, id));
  if (!ticket) { res.status(404).json({ error: "Ticket not found" }); return; }

  res.json({ ok: true, message: "AI retry queued" });
  fireAndForget(runAiAutoReply(id));
});

router.post("/admin/support/test-inbound", async (req, res): Promise<void> => {
  try {
    // Use a unique per-click token so each test run creates a fresh ticket
    // rather than appending to an existing open ticket for the same sender.
    const token = Date.now().toString(36);
    const testPayload = {
      type: "email.received",
      created_at: new Date().toISOString(),
      data: {
        from: `Test User (Inbound Email) <test-inbound+${token}@example.com>`,
        to: ["support@cloudvape.store"],
        subject: "Question about my order",
        text:
          "Hi, I just placed an order and wanted to check if it has shipped yet. " +
          "My order number is #TEST-001. Also, do you offer free shipping on orders over $50? " +
          "Thanks for your help!",
      },
    };

    // Call the actual /support/inbound-email endpoint on this same server so
    // the full webhook path — payload parsing, secret gate, ticket routing,
    // and AI auto-reply — is exercised end-to-end.
    const port = process.env.PORT ?? "8080";
    const secret = process.env.SUPPORT_WEBHOOK_SECRET;
    const secretQs = secret ? `?secret=${encodeURIComponent(secret)}` : "";
    const inboundUrl = `http://localhost:${port}/api/support/inbound-email${secretQs}`;

    const inboundRes = await fetch(inboundUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(testPayload),
    });

    const rawText = await inboundRes.text();
    let inboundBody: Record<string, unknown> = {};
    try { inboundBody = JSON.parse(rawText); } catch { /* non-JSON response */ }

    if (!inboundRes.ok) {
      const msg = typeof inboundBody.error === "string" ? inboundBody.error : rawText || `Inbound endpoint returned ${inboundRes.status}`;
      res.status(inboundRes.status).json({ error: msg });
      return;
    }

    const ticketId = inboundBody.ticketId as number;
    logger.info({ ticketId }, "Admin triggered test inbound email");
    res.json({ ok: true, ticketId });
  } catch (err) {
    logger.error({ err }, "test-inbound failed");
    res.status(500).json({ error: "Failed to send test email" });
  }
});

export default router;
