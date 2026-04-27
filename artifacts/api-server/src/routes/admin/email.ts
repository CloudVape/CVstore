import { Router, type IRouter } from "express";
import { desc, eq, and, gte, isNotNull } from "drizzle-orm";
import {
  db,
  emailLogTable,
  newsletterSubscribersTable,
  ordersTable,
} from "@workspace/db";
import { sendEmail, fireAndForget } from "../../lib/email";
import {
  marketingBroadcastTemplate,
  shippingUpdateTemplate,
  deliveryConfirmationTemplate,
  refundConfirmationTemplate,
} from "../../lib/email-templates";
import { z } from "zod";

const router: IRouter = Router();

const SITE_URL = process.env.SITE_URL ?? "https://cloudvape.store";

router.get("/admin/email-log", async (req, res): Promise<void> => {
  const template = typeof req.query.template === "string" ? req.query.template : undefined;
  const status = typeof req.query.status === "string" ? req.query.status : undefined;
  const limit = Math.min(Number(req.query.limit ?? 100), 500);

  let query = db.select().from(emailLogTable).$dynamic();
  if (template) query = query.where(eq(emailLogTable.template, template));
  if (status) query = query.where(eq(emailLogTable.status, status));

  const rows = await query.orderBy(desc(emailLogTable.createdAt)).limit(limit);
  res.json(rows);
});

router.get("/admin/newsletter/subscribers", async (_req, res): Promise<void> => {
  const rows = await db
    .select()
    .from(newsletterSubscribersTable)
    .orderBy(desc(newsletterSubscribersTable.createdAt));
  res.json(rows);
});

const BroadcastBody = z.object({
  subject: z.string().min(1),
  bodyHtml: z.string().min(1),
  bodyText: z.string().min(1),
});

router.post("/admin/newsletter/broadcast", async (req, res): Promise<void> => {
  const parsed = BroadcastBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { subject, bodyHtml, bodyText } = parsed.data;

  const subscribers = await db
    .select()
    .from(newsletterSubscribersTable)
    .where(eq(newsletterSubscribersTable.status, "confirmed"));

  if (subscribers.length === 0) {
    res.json({ message: "No confirmed subscribers to send to", sent: 0 });
    return;
  }

  const BATCH_SIZE = 50;
  let sent = 0;

  async function processBatch(batch: typeof subscribers) {
    await Promise.allSettled(
      batch.map((sub) => {
        const unsubscribeUrl = `${SITE_URL}/newsletter/unsubscribe?token=${sub.token}`;
        const tpl = marketingBroadcastTemplate({ subject, bodyHtml, bodyText, unsubscribeUrl });
        return sendEmail({ ...tpl, to: sub.email, template: "marketing-broadcast", marketing: true });
      })
    );
    sent += batch.length;
  }

  for (let i = 0; i < subscribers.length; i += BATCH_SIZE) {
    await processBatch(subscribers.slice(i, i + BATCH_SIZE));
  }

  res.json({ message: `Broadcast sent to ${sent} subscriber(s)`, sent });
});

const UpdateOrderStatusBody = z.object({
  status: z.enum(["pending", "shipped", "delivered", "refunded", "cancelled"]),
  trackingNumber: z.string().optional(),
});

router.patch("/admin/orders/:orderNumber/status", async (req, res): Promise<void> => {
  const parsed = UpdateOrderStatusBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { status, trackingNumber } = parsed.data;
  const { orderNumber } = req.params;

  const [order] = await db
    .select()
    .from(ordersTable)
    .where(eq(ordersTable.orderNumber, orderNumber));

  if (!order) {
    res.status(404).json({ error: "Order not found" });
    return;
  }

  const updates: Record<string, unknown> = { status };
  if (status === "shipped") {
    updates.shippedAt = new Date();
    if (trackingNumber) updates.trackingNumber = trackingNumber;
    const tpl = shippingUpdateTemplate({
      customerName: order.customerName,
      orderNumber: order.orderNumber,
      trackingNumber,
    });
    fireAndForget(sendEmail({ ...tpl, to: order.email, template: "shipping-update" }));
  } else if (status === "delivered") {
    updates.deliveredAt = new Date();
    const tpl = deliveryConfirmationTemplate({
      customerName: order.customerName,
      orderNumber: order.orderNumber,
    });
    fireAndForget(sendEmail({ ...tpl, to: order.email, template: "delivery-confirmation" }));
  } else if (status === "refunded") {
    updates.refundedAt = new Date();
    const tpl = refundConfirmationTemplate({
      customerName: order.customerName,
      orderNumber: order.orderNumber,
      totalCents: order.totalCents,
    });
    fireAndForget(sendEmail({ ...tpl, to: order.email, template: "refund-confirmation" }));
  }

  const [updated] = await db
    .update(ordersTable)
    .set(updates)
    .where(eq(ordersTable.orderNumber, orderNumber))
    .returning();

  res.json(updated);
});

router.get("/admin/orders", async (_req, res): Promise<void> => {
  const rows = await db
    .select()
    .from(ordersTable)
    .orderBy(desc(ordersTable.createdAt))
    .limit(200);
  res.json(rows);
});

export default router;
