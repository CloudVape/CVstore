import { pgTable, serial, integer, boolean, timestamp, unique } from "drizzle-orm/pg-core";

export const wishlistTable = pgTable(
  "wishlists",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id").notNull(),
    productId: integer("product_id").notNull(),
    lastNotifiedPriceCents: integer("last_notified_price_cents"),
    notifiedBackInStock: boolean("notified_back_in_stock").notNull().default(false),
    addedAt: timestamp("added_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique("wishlists_user_product_unique").on(t.userId, t.productId)],
);

export type Wishlist = typeof wishlistTable.$inferSelect;
