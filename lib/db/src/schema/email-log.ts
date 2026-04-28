import { pgTable, text, serial, timestamp } from "drizzle-orm/pg-core";

export const emailLogTable = pgTable("email_log", {
  id: serial("id").primaryKey(),
  recipient: text("recipient").notNull(),
  fromAddress: text("from_address"),
  template: text("template").notNull(),
  subject: text("subject").notNull(),
  status: text("status").notNull().default("pending"),
  providerMessageId: text("provider_message_id"),
  error: text("error"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type EmailLog = typeof emailLogTable.$inferSelect;
