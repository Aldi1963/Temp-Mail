import { pgTable, text, boolean, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const emailAddressesTable = pgTable("email_addresses", {
  email: text("email").primaryKey(),
  username: text("username").notNull(),
  domain: text("domain").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  expiresAt: timestamp("expires_at").notNull(),
});

export const messagesTable = pgTable("messages", {
  id: text("id").primaryKey(),
  email: text("email").notNull().references(() => emailAddressesTable.email, { onDelete: "cascade" }),
  fromAddress: text("from_address").notNull(),
  toAddress: text("to_address").notNull(),
  subject: text("subject").notNull().default("(no subject)"),
  textBody: text("text_body"),
  htmlBody: text("html_body"),
  preview: text("preview").notNull().default(""),
  isRead: boolean("is_read").notNull().default(false),
  hasAttachments: boolean("has_attachments").notNull().default(false),
  attachmentsJson: text("attachments_json").notNull().default("[]"),
  receivedAt: timestamp("received_at").defaultNow().notNull(),
  expiresAt: timestamp("expires_at").notNull(),
});

export const insertEmailAddressSchema = createInsertSchema(emailAddressesTable);
export const insertMessageSchema = createInsertSchema(messagesTable);

export type EmailAddress = typeof emailAddressesTable.$inferSelect;
export type InsertEmailAddress = z.infer<typeof insertEmailAddressSchema>;
export type Message = typeof messagesTable.$inferSelect;
export type InsertMessage = z.infer<typeof insertMessageSchema>;
