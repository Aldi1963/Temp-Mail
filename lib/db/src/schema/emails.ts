import { pgTable, text, boolean, timestamp, integer, serial, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const usersTable = pgTable("users", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  role: text("role").notNull().default("user"),
  emailVerified: boolean("email_verified").notNull().default(false),
  telegramChatId: text("telegram_chat_id"),
  suspended: boolean("suspended").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const emailVerificationTokensTable = pgTable("email_verification_tokens", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  token: text("token").notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  usedAt: timestamp("used_at"),
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
  manageTokenHash: text("manage_token_hash"),
  label: text("label"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  expiresAt: timestamp("expires_at").notNull(),
}, (t) => [index("idx_email_addresses_expires_at").on(t.expiresAt)]);

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
  archived: boolean("archived").notNull().default(false),
  hasAttachments: boolean("has_attachments").notNull().default(false),
  attachmentsJson: text("attachments_json").notNull().default("[]"),
  receivedAt: timestamp("received_at").defaultNow().notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  deletedAt: timestamp("deleted_at"),
}, (t) => [
  index("idx_messages_email").on(t.email),
  index("idx_messages_expires_at").on(t.expiresAt),
  index("idx_messages_deleted_at").on(t.deletedAt),
]);

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
}, (t) => [index("idx_api_keys_key_prefix").on(t.keyPrefix)]);

export const nativeTokensTable = pgTable("native_tokens", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  tokenHash: text("token_hash").notNull().unique(),
  name: text("name").notNull().default("android"),
  lastUsedAt: timestamp("last_used_at"),
  expiresAt: timestamp("expires_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => [index("idx_native_tokens_user_id").on(t.userId)]);

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


export const customDomainsTable = pgTable("custom_domains", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  domain: text("domain").notNull().unique(),
  status: text("status").notNull().default("pending"),
  verificationToken: text("verification_token").notNull(),
  webhookSecret: text("webhook_secret").notNull(),
  verifiedAt: timestamp("verified_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => [index("idx_custom_domains_user_id").on(t.userId)]);

export type CustomDomain = typeof customDomainsTable.$inferSelect;

export const pushTokensTable = pgTable("push_tokens", {
  token: text("token").primaryKey(),
  email: text("email"),
  userId: integer("user_id"),
  platform: text("platform").notNull().default("android"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => [index("idx_push_tokens_email").on(t.email)]);

export type PushToken = typeof pushTokensTable.$inferSelect;

export const activityLogsTable = pgTable("activity_logs", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => usersTable.id, { onDelete: "cascade" }),
  action: text("action").notNull(),
  description: text("description").notNull(),
  metadata: text("metadata").notNull().default("{}"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => [index("idx_activity_logs_user_id").on(t.userId)]);

export type ActivityLog = typeof activityLogsTable.$inferSelect;

export const insertEmailAddressSchema = createInsertSchema(emailAddressesTable);
export const insertMessageSchema = createInsertSchema(messagesTable);
export const insertUserSchema = createInsertSchema(usersTable);

export type User = typeof usersTable.$inferSelect;
export type EmailAddress = typeof emailAddressesTable.$inferSelect;
export type InsertEmailAddress = z.infer<typeof insertEmailAddressSchema>;
export type Message = typeof messagesTable.$inferSelect;
export type InsertMessage = z.infer<typeof insertMessageSchema>;
