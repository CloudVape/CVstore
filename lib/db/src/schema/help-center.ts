import { pgTable, text, serial, integer, timestamp, boolean } from "drizzle-orm/pg-core";

export const helpCategoriesTable = pgTable("help_categories", {
  id: serial("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  description: text("description"),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const helpArticlesTable = pgTable("help_articles", {
  id: serial("id").primaryKey(),
  categoryId: integer("category_id").notNull().references(() => helpCategoriesTable.id, { onDelete: "cascade" }),
  slug: text("slug").notNull().unique(),
  title: text("title").notNull(),
  body: text("body").notNull(),
  published: boolean("published").notNull().default(false),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type HelpCategory = typeof helpCategoriesTable.$inferSelect;
export type HelpArticle = typeof helpArticlesTable.$inferSelect;
