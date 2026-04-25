import { Router, Request } from "express";
import { db } from "@workspace/db";
import { emailAddressesTable, messagesTable, blockedSendersTable } from "@workspace/db";
import { eq, and, desc, lt } from "drizzle-orm";
import { randomBytes } from "crypto";
import { publicOrApiKey } from "../lib/auth.js";
import {
  GenerateEmailQueryParams,
  GetInboxQueryParams,
  GetMessageQueryParams,
  MarkMessageReadBody,
  ResetInboxQueryParams,
  GetEmailStatsQueryParams,
  ExtendEmailBody,
  GetBlacklistQueryParams,
  AddToBlacklistBody,
  RemoveFromBlacklistQueryParams,
} from "@workspace/api-zod";

const router = Router();

const AVAILABLE_DOMAINS = ["tmpmail.dev", "quickmail.io", "throwaway.net"];
const SESSION_TTL_MS = 10 * 60 * 1000; // 10 minutes
// Hard cap on total lifetime, counted from first creation. Prevents abuse
// where a caller keeps extending forever to keep a free address alive.
const MAX_LIFETIME_MS = 24 * 60 * 60 * 1000; // 24 hours
const MAX_EXTRA_MINUTES = 1440; // single-call cap (24h)

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

/** Returns missing query-param key, or null if every key is a non-empty string. */
function missingQueryParam(req: Request, ...keys: string[]): string | null {
  for (const k of keys) {
    const v = req.query[k];
    if (typeof v !== "string" || !v.trim() || v === "undefined" || v === "null") {
      return k;
    }
  }
  return null;
}

router.use(publicOrApiKey);

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
  const userId = req.session?.userId ?? null;

  let effectiveCreatedAt = now;
  let effectiveExpiresAt = expiresAt;
  if (existing.length === 0) {
    await db.insert(emailAddressesTable).values({
      email,
      username: selectedUsername,
      domain: selectedDomain,
      userId,
      createdAt: now,
      expiresAt,
    });
  } else {
    // Reusing an existing address. Enforce the same 24h-from-creation cap
    // here so /generate can't be used as a backdoor to keep an address
    // alive forever. Clamp the refreshed expiry to maxExpiresAt; if there's
    // no headroom left, return 409 just like /extend does.
    const existingRow = existing[0];
    const maxExpiresAt = new Date(
      existingRow.createdAt.getTime() + MAX_LIFETIME_MS,
    );
    if (now >= maxExpiresAt) {
      res.status(409).json({
        error: "Cap reached",
        message:
          "Alamat ini sudah mencapai batas 24 jam dari pembuatan. Silakan pilih username lain.",
        maxExpiresAt: maxExpiresAt.toISOString(),
      });
      return;
    }
    const refreshedExpiresAt =
      expiresAt > maxExpiresAt ? maxExpiresAt : expiresAt;
    const updateData: Record<string, unknown> = { expiresAt: refreshedExpiresAt };
    if (userId && !existingRow.userId) updateData.userId = userId;
    await db
      .update(emailAddressesTable)
      .set(updateData)
      .where(eq(emailAddressesTable.email, email));
    effectiveCreatedAt = existingRow.createdAt;
    effectiveExpiresAt = refreshedExpiresAt;
  }

  res.json({
    email,
    username: selectedUsername,
    domain: selectedDomain,
    expiresAt: effectiveExpiresAt.toISOString(),
    createdAt: effectiveCreatedAt.toISOString(),
  });
});

router.get("/inbox", async (req, res) => {
  const miss = missingQueryParam(req, "email");
  const parsed = GetInboxQueryParams.safeParse(req.query);
  if (miss || !parsed.success) {
    res.status(400).json({ error: "Bad request", message: `${miss ?? "email"} is required` });
    return;
  }

  await cleanupExpiredData();

  const { email } = parsed.data;
  const [messages, blocked] = await Promise.all([
    db.select().from(messagesTable).where(eq(messagesTable.email, email)).orderBy(desc(messagesTable.receivedAt)),
    db.select().from(blockedSendersTable).where(eq(blockedSendersTable.email, email)),
  ]);

  const blockedPatterns = blocked.map((b) => b.pattern.toLowerCase());

  const filteredMessages = messages.filter((m) => {
    const from = m.fromAddress.toLowerCase();
    return !blockedPatterns.some((p) => {
      if (p.startsWith("@")) return from.endsWith(p);
      return from === p;
    });
  });

  const unreadCount = filteredMessages.filter((m) => !m.isRead).length;

  const summaries = filteredMessages.map((m) => ({
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
    total: filteredMessages.length,
    unreadCount,
  });
});

router.get("/blacklist", async (req, res) => {
  const miss = missingQueryParam(req, "email");
  const parsed = GetBlacklistQueryParams.safeParse(req.query);
  if (miss || !parsed.success) {
    res.status(400).json({ error: "Bad request", message: `${miss ?? "email"} is required` });
    return;
  }
  const { email } = parsed.data;
  const blocked = await db.select().from(blockedSendersTable).where(eq(blockedSendersTable.email, email));
  res.json({
    blocked: blocked.map((b) => ({
      id: b.id,
      pattern: b.pattern,
      createdAt: b.createdAt.toISOString(),
    })),
  });
});

router.post("/blacklist", async (req, res) => {
  const parsed = AddToBlacklistBody.safeParse(req.body);
  if (!parsed.success || !parsed.data.email || !parsed.data.pattern) {
    res.status(400).json({ error: "Bad request", message: "email and pattern are required" });
    return;
  }
  const { email, pattern } = parsed.data;
  const normalized = pattern.toLowerCase().trim();

  const existing = await db
    .select()
    .from(blockedSendersTable)
    .where(and(eq(blockedSendersTable.email, email), eq(blockedSendersTable.pattern, normalized)))
    .limit(1);

  if (existing.length > 0) {
    res.json({ success: true, message: "Already blocked" });
    return;
  }

  await db.insert(blockedSendersTable).values({ email, pattern: normalized });
  res.json({ success: true, message: `Blocked: ${normalized}` });
});

router.delete("/blacklist", async (req, res) => {
  const miss = missingQueryParam(req, "email", "pattern");
  const parsed = RemoveFromBlacklistQueryParams.safeParse(req.query);
  if (miss || !parsed.success || !parsed.data.email || !parsed.data.pattern) {
    res.status(400).json({ error: "Bad request", message: "email and pattern are required" });
    return;
  }
  const { email, pattern } = parsed.data;
  await db
    .delete(blockedSendersTable)
    .where(and(eq(blockedSendersTable.email, email), eq(blockedSendersTable.pattern, pattern)));
  res.json({ success: true, message: "Removed from blacklist" });
});

router.get("/message", async (req, res) => {
  const miss = missingQueryParam(req, "id", "email");
  const parsed = GetMessageQueryParams.safeParse(req.query);
  if (miss || !parsed.success || !parsed.data.id || !parsed.data.email) {
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
  const miss = missingQueryParam(req, "email");
  const parsed = ResetInboxQueryParams.safeParse(req.query);
  if (miss || !parsed.success || !parsed.data.email) {
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
  const miss = missingQueryParam(req, "email");
  const parsed = GetEmailStatsQueryParams.safeParse(req.query);
  if (miss || !parsed.success || !parsed.data.email) {
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

  const maxExpiresAt = new Date(addr.createdAt.getTime() + MAX_LIFETIME_MS);
  res.json({
    email,
    totalMessages: messages.length,
    readCount,
    unreadCount,
    expiresAt: addr.expiresAt.toISOString(),
    isExpired: addr.expiresAt < now,
    createdAt: addr.createdAt.toISOString(),
    maxExpiresAt: maxExpiresAt.toISOString(),
  });
});

router.post("/extend", async (req, res) => {
  const parsed = ExtendEmailBody.safeParse(req.body);
  if (!parsed.success) {
    // Differentiate the two common cases so the client gets an actionable
    // message instead of a generic "bad request".
    const issues = parsed.error.issues;
    const isExtraMinutesIssue = issues.some((i) =>
      i.path.includes("extraMinutes"),
    );
    res.status(400).json({
      error: "Bad request",
      message: isExtraMinutesIssue
        ? `extraMinutes harus bilangan bulat antara 1 dan ${MAX_EXTRA_MINUTES}.`
        : "email is required",
    });
    return;
  }
  if (!parsed.data.email) {
    res
      .status(400)
      .json({ error: "Bad request", message: "email is required" });
    return;
  }

  const { email } = parsed.data;
  // Server-side belt-and-suspenders integer + range guard. The openapi
  // schema declares `type: integer` but the generated zod uses
  // .number().min(1).max(1440), which lets fractional values slip through.
  // Reject non-integers explicitly so the contract matches the spec.
  const requestedMinutes = parsed.data.extraMinutes ?? 30;
  if (!Number.isInteger(requestedMinutes)) {
    res.status(400).json({
      error: "Bad request",
      message: `extraMinutes harus bilangan bulat antara 1 dan ${MAX_EXTRA_MINUTES}.`,
    });
    return;
  }
  const safeMinutes = Math.max(1, Math.min(requestedMinutes, MAX_EXTRA_MINUTES));
  const extra = safeMinutes * 60 * 1000;

  const results = await db
    .select()
    .from(emailAddressesTable)
    .where(eq(emailAddressesTable.email, email))
    .limit(1);
  if (results.length === 0) {
    res.status(404).json({ error: "Not found", message: "Email address not found" });
    return;
  }

  const current = results[0];
  const now = new Date();
  const base = current.expiresAt > now ? current.expiresAt : now;
  const desiredExpiresAt = new Date(base.getTime() + extra);
  const maxExpiresAt = new Date(current.createdAt.getTime() + MAX_LIFETIME_MS);

  // Cap reached when EITHER the stored expiry is already at/over the cap
  // OR the wall clock has crossed the cap (stale record awaiting cleanup).
  // In both cases there's no meaningful headroom left, so a 200 "extended"
  // response would be misleading — return 409 instead.
  if (current.expiresAt >= maxExpiresAt || base >= maxExpiresAt) {
    res.status(409).json({
      error: "Cap reached",
      message:
        "Maksimum masa aktif (24 jam sejak dibuat) sudah tercapai. Silakan buat email baru.",
      maxExpiresAt: maxExpiresAt.toISOString(),
    });
    return;
  }

  // Clamp newExpiresAt to the cap so we can never exceed MAX_LIFETIME_MS
  const capped = desiredExpiresAt > maxExpiresAt;
  const newExpiresAt = capped ? maxExpiresAt : desiredExpiresAt;
  const appliedMinutes = Math.max(
    0,
    Math.round((newExpiresAt.getTime() - base.getTime()) / 60000),
  );

  await db
    .update(emailAddressesTable)
    .set({ expiresAt: newExpiresAt })
    .where(eq(emailAddressesTable.email, email));
  await db
    .update(messagesTable)
    .set({ expiresAt: newExpiresAt })
    .where(eq(messagesTable.email, email));

  res.json({
    email,
    newExpiresAt: newExpiresAt.toISOString(),
    extended: true,
    maxExpiresAt: maxExpiresAt.toISOString(),
    capped,
    appliedMinutes,
  });
});

export { router as emailRouter, generateMessageId, SESSION_TTL_MS, AVAILABLE_DOMAINS };
