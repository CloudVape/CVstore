import { pgTable, text, serial, integer, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export type ImportRowError = {
  row: number;
  externalSku: string | null;
  message: string;
};

export const importRunsTable = pgTable("import_runs", {
  id: serial("id").primaryKey(),
  supplierId: integer("supplier_id").notNull(),
  triggeredByUserId: integer("triggered_by_user_id"),
  status: text("status").notNull().default("running"), // 'running' | 'completed' | 'failed'
  source: text("source").notNull(), // 'csv-upload' | 'csv-url'
  sourceUrl: text("source_url"),
  totalRows: integer("total_rows").notNull().default(0),
  createdCount: integer("created_count").notNull().default(0),
  updatedCount: integer("updated_count").notNull().default(0),
  skippedCount: integer("skipped_count").notNull().default(0),
  erroredCount: integer("errored_count").notNull().default(0),
  errors: jsonb("errors").$type<ImportRowError[]>().notNull().default([]),
  errorMessage: text("error_message"),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
  finishedAt: timestamp("finished_at", { withTimezone: true }),
});

export const insertImportRunSchema = createInsertSchema(importRunsTable).omit({ id: true, startedAt: true });
export type InsertImportRun = z.infer<typeof insertImportRunSchema>;
export type ImportRun = typeof importRunsTable.$inferSelect;
