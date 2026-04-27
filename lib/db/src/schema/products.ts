import { pgTable, text, serial, integer, boolean, timestamp, numeric, index, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const productsTable = pgTable(
  "products",
  {
    id: serial("id").primaryKey(),
    name: text("name").notNull(),
    slug: text("slug").notNull().unique(),
    brand: text("brand").notNull(),
    shortDescription: text("short_description").notNull(),
    description: text("description").notNull(),
    priceCents: integer("price_cents").notNull(),
    comparePriceCents: integer("compare_price_cents"),
    categoryId: integer("category_id").notNull(),
    imageUrl: text("image_url").notNull(),
    imageGallery: text("image_gallery").array().notNull().default([]),
    rating: numeric("rating", { precision: 3, scale: 2 }).notNull().default("0"),
    reviewCount: integer("review_count").notNull().default(0),
    stockCount: integer("stock_count").notNull().default(0),
    inStock: boolean("in_stock").notNull().default(true),
    isFeatured: boolean("is_featured").notNull().default(false),
    isNew: boolean("is_new").notNull().default(false),
    isBestseller: boolean("is_bestseller").notNull().default(false),
    flavor: text("flavor"),
    nicotineStrength: text("nicotine_strength"),
    vgPgRatio: text("vg_pg_ratio"),
    bottleSize: text("bottle_size"),
    tags: text("tags").array().notNull().default([]),
    // Dropshipper / supplier import fields
    supplierId: integer("supplier_id"),
    externalSku: text("external_sku"),
    lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (t) => ({
    supplierSkuUnique: uniqueIndex("products_supplier_sku_unique").on(t.supplierId, t.externalSku),
    supplierIdx: index("products_supplier_idx").on(t.supplierId),
  }),
);

export const insertProductSchema = createInsertSchema(productsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertProduct = z.infer<typeof insertProductSchema>;
export type Product = typeof productsTable.$inferSelect;
