import { pgTable, text, serial, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

/**
 * A "column mapping" maps a store product field (key) to a supplier feed
 * column name (value). Field key is one of the importable product fields.
 * Empty/missing values mean "do not import this field".
 */
export type SupplierColumnMapping = Record<string, string>;

/**
 * Schedule configuration for automatic supplier sync. The background scheduler
 * reads this field and executes imports at the chosen cadence.
 */
export type SupplierSchedule = {
  enabled: boolean;
  frequency: "hourly" | "daily" | "weekly" | "manual";
  hourOfDay?: number | null;
  notes?: string | null;
};

export type FeedFormat = "csv" | "json" | "xml" | "shopify";

export const suppliersTable = pgTable("suppliers", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  sourceType: text("source_type").notNull(), // 'csv-upload' | 'csv-url'
  feedFormat: text("feed_format").notNull().default("csv"), // FeedFormat
  sourceUrl: text("source_url"),
  columnMapping: jsonb("column_mapping").$type<SupplierColumnMapping>().notNull().default({}),
  schedule: jsonb("schedule").$type<SupplierSchedule | null>(),
  lastRunAt: timestamp("last_run_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertSupplierSchema = createInsertSchema(suppliersTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertSupplier = z.infer<typeof insertSupplierSchema>;
export type Supplier = typeof suppliersTable.$inferSelect;
