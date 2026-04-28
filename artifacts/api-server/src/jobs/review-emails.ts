import { db, ordersTable, type OrderItem } from "@workspace/db";
import { and, eq, isNotNull, lte, isNull } from "drizzle-orm";
import { logger } from "../lib/logger";
import { sendEmail } from "../lib/email";
import { reviewRequestTemplate } from "../lib/email-templates";
import { getSiteUrl } from "../lib/config";

const DAYS_AFTER_DELIVERY = 4;
const CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000;

async function sendPendingReviewEmails(): Promise<void> {
  const cutoff = new Date(Date.now() - DAYS_AFTER_DELIVERY * 24 * 60 * 60 * 1000);

  const orders = await db
    .select()
    .from(ordersTable)
    .where(
      and(
        eq(ordersTable.status, "delivered"),
        isNotNull(ordersTable.deliveredAt),
        lte(ordersTable.deliveredAt, cutoff),
        eq(ordersTable.reviewEmailSent, false),
      )
    );

  if (orders.length === 0) {
    logger.debug("review-emails: no pending orders");
    return;
  }

  logger.info({ count: orders.length }, "review-emails: sending review requests");

  const siteUrl = await getSiteUrl();

  for (const order of orders) {
    try {
      const tpl = reviewRequestTemplate({
        customerName: order.customerName,
        orderNumber: order.orderNumber,
        items: order.items as OrderItem[],
        siteUrl,
      });
      await sendEmail({ ...tpl, to: order.email, template: "review-request" });
      await db
        .update(ordersTable)
        .set({ reviewEmailSent: true })
        .where(eq(ordersTable.id, order.id));
    } catch (err) {
      logger.error({ err, orderNumber: order.orderNumber }, "review-emails: failed for order");
    }
  }
}

export function startReviewEmailJob(): void {
  logger.info("review-emails: job started");

  async function tick() {
    try {
      await sendPendingReviewEmails();
    } catch (err) {
      logger.error({ err }, "review-emails: tick error");
    }
    setTimeout(tick, CHECK_INTERVAL_MS);
  }

  setTimeout(tick, 5 * 60 * 1000);
}
