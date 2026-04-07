import { Router } from "express";
import { db } from "@workspace/db";
import { emailAddressesTable, messagesTable } from "@workspace/db";
import { eq, and, desc, lt } from "drizzle-orm";
import { randomBytes } from "crypto";
import {
  GenerateEmailQueryParams,
  GetInboxQueryParams,
  GetMessageQueryParams,
  MarkMessageReadBody,
  ResetInboxQueryParams,
  GetEmailStatsQueryParams,
  ExtendEmailBody,
} from "@workspace/api-zod";

const router = Router();

const AVAILABLE_DOMAINS = ["tmpmail.dev", "quickmail.io", "throwaway.net"];
const SESSION_TTL_MS = 10 * 60 * 1000; // 10 minutes

function generateUsername(length = 8): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  const bytes = randomBytes(length);
  let result = "";
  for (let i = 0; i < length; i++) {
    result += chars[bytes[i] % chars.length];
  }
  return result;
}

function generateMessageId(): string {
  return randomBytes(16).toString("hex");
}

async function cleanupExpiredData() {
  const now = new Date();
  await db.delete(messagesTable).where(lt(messagesTable.expiresAt, now));
  await db.delete(emailAddressesTable).where(lt(emailAddressesTable.expiresAt, now));
}

router.get("/generate", async (req, res) => {
  const parsed = GenerateEmailQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "Bad request", message: "Invalid query parameters" });
    return;
  }

  await cleanupExpiredData();

  const { username, domain } = parsed.data;
  const selectedDomain = domain && AVAILABLE_DOMAINS.includes(domain) ? domain : AVAILABLE_DOMAINS[0];
  const selectedUsername = username && /^[a-z0-9._-]{1,30}$/.test(username) ? username : generateUsername();
  const email = `${selectedUsername}@${selectedDomain}`;
  const now = new Date();
  const expiresAt = new Date(now.getTime() + SESSION_TTL_MS);

  const existing = await db.select().from(emailAddressesTable).where(eq(emailAddressesTable.email, email)).limit(1);

  if (existing.length === 0) {
    await db.insert(emailAddressesTable).values({
      email,
      username: selectedUsername,
      domain: selectedDomain,
      createdAt: now,
      expiresAt,
    });
  } else {
    await db.update(emailAddressesTable).set({ expiresAt }).where(eq(emailAddressesTable.email, email));
  }

  res.json({
    email,
    username: selectedUsername,
    domain: selectedDomain,
    expiresAt: expiresAt.toISOString(),
    createdAt: now.toISOString(),
  });
});

router.get("/inbox", async (req, res) => {
  const parsed = GetInboxQueryParams.safeParse(req.query);
  if (!parsed.success || !parsed.data.email) {
    res.status(400).json({ error: "Bad request", message: "email is required" });
    return;
  }

  await cleanupExpiredData();

  const { email } = parsed.data;
  const messages = await db
    .select()
    .from(messagesTable)
    .where(eq(messagesTable.email, email))
    .orderBy(desc(messagesTable.receivedAt));

  const unreadCount = messages.filter((m) => !m.isRead).length;

  const summaries = messages.map((m) => ({
    id: m.id,
    from: m.fromAddress,
    subject: m.subject,
    preview: m.preview,
    receivedAt: m.receivedAt.toISOString(),
    isRead: m.isRead,
    hasAttachments: m.hasAttachments,
  }));

  res.json({
    email,
    messages: summaries,
    total: messages.length,
    unreadCount,
  });
});

router.get("/message", async (req, res) => {
  const parsed = GetMessageQueryParams.safeParse(req.query);
  if (!parsed.success || !parsed.data.id || !parsed.data.email) {
    res.status(400).json({ error: "Bad request", message: "id and email are required" });
    return;
  }

  const { id, email } = parsed.data;
  const results = await db
    .select()
    .from(messagesTable)
    .where(and(eq(messagesTable.id, id), eq(messagesTable.email, email)))
    .limit(1);

  if (results.length === 0) {
    res.status(404).json({ error: "Not found", message: "Message not found" });
    return;
  }

  const m = results[0];
  let attachments: { filename: string; contentType: string; size: number }[] = [];
  try {
    attachments = JSON.parse(m.attachmentsJson ?? "[]");
  } catch {
    attachments = [];
  }

  res.json({
    id: m.id,
    email: m.email,
    from: m.fromAddress,
    to: m.toAddress,
    subject: m.subject,
    textBody: m.textBody ?? undefined,
    htmlBody: m.htmlBody ?? undefined,
    receivedAt: m.receivedAt.toISOString(),
    isRead: m.isRead,
    attachments,
  });
});

router.patch("/message/read", async (req, res) => {
  const parsed = MarkMessageReadBody.safeParse(req.body);
  if (!parsed.success || !parsed.data.id || !parsed.data.email) {
    res.status(400).json({ error: "Bad request", message: "id and email are required" });
    return;
  }

  const { id, email } = parsed.data;
  const results = await db
    .select()
    .from(messagesTable)
    .where(and(eq(messagesTable.id, id), eq(messagesTable.email, email)))
    .limit(1);

  if (results.length === 0) {
    res.status(404).json({ error: "Not found", message: "Message not found" });
    return;
  }

  await db.update(messagesTable).set({ isRead: true }).where(and(eq(messagesTable.id, id), eq(messagesTable.email, email)));

  res.json({ success: true, message: "Message marked as read" });
});

router.delete("/reset", async (req, res) => {
  const parsed = ResetInboxQueryParams.safeParse(req.query);
  if (!parsed.success || !parsed.data.email) {
    res.status(400).json({ error: "Bad request", message: "email is required" });
    return;
  }

  const { email } = parsed.data;
  await db.delete(messagesTable).where(eq(messagesTable.email, email));

  res.json({ success: true, message: "Inbox cleared" });
});

router.get("/domains", async (_req, res) => {
  res.json({ domains: AVAILABLE_DOMAINS });
});

router.get("/stats", async (req, res) => {
  const parsed = GetEmailStatsQueryParams.safeParse(req.query);
  if (!parsed.success || !parsed.data.email) {
    res.status(400).json({ error: "Bad request", message: "email is required" });
    return;
  }

  const { email } = parsed.data;
  const addrResults = await db.select().from(emailAddressesTable).where(eq(emailAddressesTable.email, email)).limit(1);

  if (addrResults.length === 0) {
    const now = new Date();
    const defaultExpiry = new Date(now.getTime() + SESSION_TTL_MS);
    res.json({
      email,
      totalMessages: 0,
      readCount: 0,
      unreadCount: 0,
      expiresAt: defaultExpiry.toISOString(),
      isExpired: false,
    });
    return;
  }

  const addr = addrResults[0];
  const messages = await db.select().from(messagesTable).where(eq(messagesTable.email, email));
  const readCount = messages.filter((m) => m.isRead).length;
  const unreadCount = messages.filter((m) => !m.isRead).length;
  const now = new Date();

  res.json({
    email,
    totalMessages: messages.length,
    readCount,
    unreadCount,
    expiresAt: addr.expiresAt.toISOString(),
    isExpired: addr.expiresAt < now,
  });
});

router.post("/extend", async (req, res) => {
  const parsed = ExtendEmailBody.safeParse(req.body);
  if (!parsed.success || !parsed.data.email) {
    res.status(400).json({ error: "Bad request", message: "email is required" });
    return;
  }

  const { email, extraMinutes } = parsed.data;
  const extra = (extraMinutes ?? 30) * 60 * 1000;

  const results = await db.select().from(emailAddressesTable).where(eq(emailAddressesTable.email, email)).limit(1);
  if (results.length === 0) {
    res.status(404).json({ error: "Not found", message: "Email address not found" });
    return;
  }

  const current = results[0];
  const base = current.expiresAt > new Date() ? current.expiresAt : new Date();
  const newExpiresAt = new Date(base.getTime() + extra);

  await db.update(emailAddressesTable).set({ expiresAt: newExpiresAt }).where(eq(emailAddressesTable.email, email));
  await db.update(messagesTable).set({ expiresAt: newExpiresAt }).where(eq(messagesTable.email, email));

  res.json({ email, newExpiresAt: newExpiresAt.toISOString(), extended: true });
});

export { router as emailRouter, generateMessageId, SESSION_TTL_MS, AVAILABLE_DOMAINS };
