import { pgTable, text, boolean, timestamp, integer, serial } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const usersTable = pgTable("users", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  role: text("role").notNull().default("user"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const siteSettingsTable = pgTable("site_settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const emailAddressesTable = pgTable("email_addresses", {
  email: text("email").primaryKey(),
  username: text("username").notNull(),
  domain: text("domain").notNull(),
  userId: integer("user_id").references(() => usersTable.id, { onDelete: "set null" }),
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

export const blockedSendersTable = pgTable("blocked_senders", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().references(() => emailAddressesTable.email, { onDelete: "cascade" }),
  pattern: text("pattern").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const apiKeysTable = pgTable("api_keys", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  keyPrefix: text("key_prefix").notNull(),
  keyHash: text("key_hash").notNull(),
  lastUsedAt: timestamp("last_used_at"),
  expiresAt: timestamp("expires_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const webhooksTable = pgTable("webhooks", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  url: text("url").notNull(),
  events: text("events").notNull().default('["new_message"]'),
  secret: text("secret").notNull(),
  active: boolean("active").notNull().default(true),
  lastTriggeredAt: timestamp("last_triggered_at"),
  failCount: integer("fail_count").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const userTwoFactorTable = pgTable("user_two_factor", {
  userId: integer("user_id").primaryKey().references(() => usersTable.id, { onDelete: "cascade" }),
  secret: text("secret").notNull(),
  enabled: boolean("enabled").notNull().default(false),
  backupCodes: text("backup_codes").notNull().default("[]"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertEmailAddressSchema = createInsertSchema(emailAddressesTable);
export const insertMessageSchema = createInsertSchema(messagesTable);
export const insertUserSchema = createInsertSchema(usersTable);

export type User = typeof usersTable.$inferSelect;
export type EmailAddress = typeof emailAddressesTable.$inferSelect;
export type InsertEmailAddress = z.infer<typeof insertEmailAddressSchema>;
export type Message = typeof messagesTable.$inferSelect;
export type InsertMessage = z.infer<typeof insertMessageSchema>;
