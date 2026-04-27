import { Router, type IRouter } from "express";
import { eq, desc, and } from "drizzle-orm";
import { z } from "zod/v4";
import { db, supportTicketsTable, supportMessagesTable } from "@workspace/db";
import { sendEmail, fireAndForget } from "../../lib/email";
import { ticketReplyTemplate } from "../../lib/email-templates";
import { runAiAutoReply } from "../support";

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

export default router;
