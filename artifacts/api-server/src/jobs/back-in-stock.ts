import { db, wishlistTable, productsTable, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "../lib/logger";
import { sendEmail } from "../lib/email";
import { backInStockTemplate, priceDropTemplate } from "../lib/email-templates";
import { getSiteUrl } from "../lib/config";

const CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000;
const PRICE_DROP_THRESHOLD = 0.05;

async function runCheck(): Promise<void> {
  const siteUrl = await getSiteUrl();

  const rows = await db
    .select({
      wishlist: wishlistTable,
      product: productsTable,
      user: usersTable,
    })
    .from(wishlistTable)
    .innerJoin(productsTable, eq(wishlistTable.productId, productsTable.id))
    .innerJoin(usersTable, eq(wishlistTable.userId, usersTable.id));

  for (const row of rows) {
    const { wishlist, product, user } = row;
    const productUrl = `${siteUrl}/shop/p/${product.slug}`;

    try {
      if (product.inStock && !wishlist.notifiedBackInStock) {
        const tpl = backInStockTemplate({
          username: user.username,
          productName: product.name,
          productUrl,
          siteUrl,
        });
        await sendEmail({ ...tpl, to: user.email, template: "back-in-stock" });
        await db
          .update(wishlistTable)
          .set({ notifiedBackInStock: true })
          .where(eq(wishlistTable.id, wishlist.id));
        logger.info({ productId: product.id, userId: user.id }, "back-in-stock: alert sent");
        continue;
      }

      if (!product.inStock && wishlist.notifiedBackInStock) {
        await db
          .update(wishlistTable)
          .set({ notifiedBackInStock: false })
          .where(eq(wishlistTable.id, wishlist.id));
      }

      const lastPrice = wishlist.lastNotifiedPriceCents;
      if (lastPrice !== null && product.inStock) {
        const drop = (lastPrice - product.priceCents) / lastPrice;
        if (drop >= PRICE_DROP_THRESHOLD) {
          const tpl = priceDropTemplate({
            username: user.username,
            productName: product.name,
            oldPriceCents: lastPrice,
            newPriceCents: product.priceCents,
            productUrl,
            siteUrl,
          });
          await sendEmail({ ...tpl, to: user.email, template: "price-drop" });
          await db
            .update(wishlistTable)
            .set({ lastNotifiedPriceCents: product.priceCents })
            .where(eq(wishlistTable.id, wishlist.id));
          logger.info({ productId: product.id, userId: user.id }, "price-drop: alert sent");
        }
      } else if (lastPrice === null) {
        await db
          .update(wishlistTable)
          .set({ lastNotifiedPriceCents: product.priceCents })
          .where(eq(wishlistTable.id, wishlist.id));
      }
    } catch (err) {
      logger.error({ err, productId: product.id, userId: user.id }, "back-in-stock: alert failed");
    }
  }
}

export function startBackInStockJob(): void {
  logger.info("back-in-stock: job started");

  async function tick() {
    try {
      await runCheck();
    } catch (err) {
      logger.error({ err }, "back-in-stock: tick error");
    }
    setTimeout(tick, CHECK_INTERVAL_MS);
  }

  setTimeout(tick, 10 * 60 * 1000);
}
