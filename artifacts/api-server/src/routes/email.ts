import { Router, Request } from "express";
import { db } from "@workspace/db";
import { emailAddressesTable, messagesTable, blockedSendersTable, siteSettingsTable, customDomainsTable } from "@workspace/db";
import { eq, and, desc, lt, isNull, isNotNull } from "drizzle-orm";
import { randomBytes, createHash, timingSafeEqual } from "crypto";
import rateLimit from "express-rate-limit";
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

const FALLBACK_DOMAINS = ["tmpmail.dev", "quickmail.io", "throwaway.net"];

export async function getActiveDomains(): Promise<string[]> {
  try {
    const rows = await db
      .select()
      .from(siteSettingsTable)
      .where(eq(siteSettingsTable.key, "available_domains"));
    if (rows.length > 0 && rows[0].value) {
      const parsed = JSON.parse(rows[0].value);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch {
    // fallback
  }
  return FALLBACK_DOMAINS;
}

export async function getUserCustomDomains(userId: number): Promise<string[]> {
  try {
    const rows = await db
      .select({ domain: customDomainsTable.domain })
      .from(customDomainsTable)
      .where(and(eq(customDomainsTable.userId, userId), eq(customDomainsTable.status, "active")));
    return rows.map((r) => r.domain);
  } catch {
    return [];
  }
}

const AVAILABLE_DOMAINS = FALLBACK_DOMAINS;
// Masa aktif email dan pesan diset 30 hari
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
const MAX_LIFETIME_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
const MAX_EXTRA_MINUTES = 30 * 24 * 60; // 30 days

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

/**
 * [SECURITY] Kepemilikan alamat untuk operasi destruktif (/reset, /destroy).
 *
 * Desain pragmatis untuk alur temp-mail anonim:
 * - Saat alamat DIBUAT, server menerbitkan manage token acak (dikembalikan di
 *   respons /generate, disimpan frontend di localStorage). Hanya hash SHA-256
 *   yang disimpan di DB.
 * - /reset & /destroy wajib menyertakan token via header X-Manage-Token
 *   (atau query ?manageToken=), KECUALI: sesi login pemilik alamat atau
 *   API key pemilik alamat.
 * - Alamat lama (manageTokenHash NULL, dibuat sebelum fitur ini): tetap
 *   diizinkan seperti dulu (legacy) demi kompatibilitas, tapi sudah
 *   dilindungi rate limiter.
 */
function generateManageToken(): string {
  return `tmm_${randomBytes(24).toString("hex")}`;
}
function hashManageToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}
function manageTokenMatches(provided: string, storedHash: string): boolean {
  const a = Buffer.from(hashManageToken(provided), "utf8");
  const b = Buffer.from(storedHash, "utf8");
  return a.length === b.length && timingSafeEqual(a, b);
}
async function checkAddressOwnership(req: Request, email: string): Promise<{ ok: boolean; notFound?: boolean }> {
  const rows = await db
    .select()
    .from(emailAddressesTable)
    .where(eq(emailAddressesTable.email, email))
    .limit(1);
  if (rows.length === 0) return { ok: false, notFound: true };
  const addr = rows[0];
  if (!addr.manageTokenHash) return { ok: true }; // legacy: dibuat sebelum fitur token
  const provided =
    (req.headers["x-manage-token"] as string) || (req.query.manageToken as string) || "";
  if (provided && manageTokenMatches(provided, addr.manageTokenHash)) return { ok: true };
  const sessionUserId = (req as Request & { session?: { userId?: number } }).session?.userId;
  if (sessionUserId && addr.userId && addr.userId === sessionUserId) return { ok: true };
  const apiKeyUserId = (req as Request & { apiKeyUserId?: number }).apiKeyUserId;
  if (apiKeyUserId && addr.userId && addr.userId === apiKeyUserId) return { ok: true };
  return { ok: false };
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

// [SECURITY] Anti-abuse: batas laju per IP untuk seluruh endpoint email publik.
// Polling inbox normal (tiap beberapa detik) jauh di bawah batas ini.
const emailGeneralLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 600,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too Many Requests", message: "Terlalu banyak permintaan. Coba lagi beberapa saat." },
});
const generateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too Many Requests", message: "Terlalu banyak pembuatan alamat. Coba lagi dalam 1 jam." },
});
router.use(emailGeneralLimiter);

router.get("/generate", generateLimiter, async (req, res) => {
  const parsed = GenerateEmailQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "Bad request", message: "Invalid query parameters" });
    return;
  }

  const { username, domain } = parsed.data;
  const activeDomains = await getActiveDomains();
  const genUserId = req.session?.userId ?? (req as any).apiKeyUserId ?? null;
  const allowedDomains = genUserId
    ? [...activeDomains, ...(await getUserCustomDomains(genUserId))]
    : activeDomains;
  const selectedDomain = domain && allowedDomains.includes(domain) ? domain : activeDomains[0];
  const selectedUsername = username && /^[a-z0-9._-]{1,30}$/.test(username) ? username : generateUsername();
  const email = `${selectedUsername}@${selectedDomain}`;
  const now = new Date();
  const expiresAt = new Date(now.getTime() + SESSION_TTL_MS);

  const existing = await db.select().from(emailAddressesTable).where(eq(emailAddressesTable.email, email)).limit(1);
  const userId = genUserId;

  let effectiveCreatedAt = now;
  let effectiveExpiresAt = expiresAt;
  let manageToken: string | undefined;
  if (existing.length === 0) {
    manageToken = generateManageToken();
    await db.insert(emailAddressesTable).values({
      email,
      username: selectedUsername,
      domain: selectedDomain,
      userId,
      manageTokenHash: hashManageToken(manageToken),
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
    // Bila pemanggil terbukti pemilik (token valid / sesi / api key), rotasi token
    // agar pemilik yang kehilangan token bisa mendapat yang baru.
    const reuseOwnership = await checkAddressOwnership(req, email);
    if (reuseOwnership.ok && existingRow.manageTokenHash) {
      manageToken = generateManageToken();
      updateData.manageTokenHash = hashManageToken(manageToken);
    }
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
    // manageToken hanya dikembalikan saat alamat BARU dibuat atau saat
    // kepemilikan terbukti (rotasi). Simpan di sisi klien; hanya hash yang disimpan server.
    ...(manageToken ? { manageToken } : {}),
  });
});

router.get("/inbox", async (req, res) => {
  const miss = missingQueryParam(req, "email");
  const parsed = GetInboxQueryParams.safeParse(req.query);
  if (miss || !parsed.success) {
    res.status(400).json({ error: "Bad request", message: `${miss ?? "email"} is required` });
    return;
  }

  const { email } = parsed.data;
  const wantArchived = req.query.archived === "true";
  const [messages, blocked] = await Promise.all([
    db.select().from(messagesTable).where(and(eq(messagesTable.email, email), eq(messagesTable.archived, wantArchived), isNull(messagesTable.deletedAt))).orderBy(desc(messagesTable.receivedAt)),
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
    archived: m.archived,
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

  const ownership = await checkAddressOwnership(req, email);
  if (!ownership.ok) {
    res.status(ownership.notFound ? 404 : 403).json({
      error: ownership.notFound ? "Not found" : "Forbidden",
      message: ownership.notFound
        ? "Alamat email tidak ditemukan."
        : "Operasi ini butuh bukti kepemilikan alamat (header X-Manage-Token).",
    });
    return;
  }

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

  const ownership = await checkAddressOwnership(req, email);
  if (!ownership.ok) {
    res.status(ownership.notFound ? 404 : 403).json({
      error: ownership.notFound ? "Not found" : "Forbidden",
      message: ownership.notFound
        ? "Alamat email tidak ditemukan."
        : "Operasi ini butuh bukti kepemilikan alamat (header X-Manage-Token).",
    });
    return;
  }

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
    .where(and(eq(messagesTable.id, id), eq(messagesTable.email, email), isNull(messagesTable.deletedAt)))
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
    .where(and(eq(messagesTable.id, id), eq(messagesTable.email, email), isNull(messagesTable.deletedAt)))
    .limit(1);

  if (results.length === 0) {
    res.status(404).json({ error: "Not found", message: "Message not found" });
    return;
  }

  await db.update(messagesTable).set({ isRead: true }).where(and(eq(messagesTable.id, id), eq(messagesTable.email, email), isNull(messagesTable.deletedAt)));

  res.json({ success: true, message: "Message marked as read" });
});

// Hapus satu pesan (swipe kiri ala Gmail) — SOFT DELETE ke tong sampah.
// Undo: POST /message/restore. Hapus permanen: DELETE /message/permanent.
router.delete("/message", async (req, res) => {
  const miss = missingQueryParam(req, "id", "email");
  const parsed = GetMessageQueryParams.safeParse(req.query);
  if (miss || !parsed.success || !parsed.data.id || !parsed.data.email) {
    res.status(400).json({ error: "Bad request", message: "id and email are required" });
    return;
  }

  const { id, email } = parsed.data;

  const ownership = await checkAddressOwnership(req, email);
  if (!ownership.ok) {
    res.status(ownership.notFound ? 404 : 403).json({
      error: ownership.notFound ? "Not found" : "Forbidden",
      message: ownership.notFound
        ? "Alamat email tidak ditemukan."
        : "Operasi ini butuh bukti kepemilikan alamat (header X-Manage-Token).",
    });
    return;
  }

  const trashed = await db
    .update(messagesTable)
    .set({ deletedAt: new Date() })
    .where(and(eq(messagesTable.id, id), eq(messagesTable.email, email), isNull(messagesTable.deletedAt)))
    .returning({ id: messagesTable.id });

  if (trashed.length === 0) {
    res.status(404).json({ error: "Not found", message: "Message not found" });
    return;
  }

  res.json({ success: true, message: "Message moved to trash" });
});

// Arsip / batal arsip satu pesan (swipe kanan ala Gmail)
router.patch("/message/archive", async (req, res) => {
  const body = (req.body ?? {}) as { id?: unknown; email?: unknown; archived?: unknown };
  if (typeof body.id !== "string" || !body.id || typeof body.email !== "string" || !body.email || typeof body.archived !== "boolean") {
    res.status(400).json({ error: "Bad request", message: "id, email, and archived are required" });
    return;
  }

  const { id, email, archived } = body as { id: string; email: string; archived: boolean };

  const ownership = await checkAddressOwnership(req, email);
  if (!ownership.ok) {
    res.status(ownership.notFound ? 404 : 403).json({
      error: ownership.notFound ? "Not found" : "Forbidden",
      message: ownership.notFound
        ? "Alamat email tidak ditemukan."
        : "Operasi ini butuh bukti kepemilikan alamat (header X-Manage-Token).",
    });
    return;
  }

  const updated = await db
    .update(messagesTable)
    .set({ archived })
    .where(and(eq(messagesTable.id, id), eq(messagesTable.email, email), isNull(messagesTable.deletedAt)))
    .returning({ id: messagesTable.id });

  if (updated.length === 0) {
    res.status(404).json({ error: "Not found", message: "Message not found" });
    return;
  }

  res.json({ success: true, archived, message: archived ? "Message archived" : "Message unarchived" });
});

// Tong sampah: daftar pesan yang dihapus (soft-delete), milik alamat.
// Hanya pesan dengan deleted_at terisi; urut dari yang paling baru dihapus.
router.get("/trash", async (req, res) => {
  const miss = missingQueryParam(req, "email");
  const parsed = GetInboxQueryParams.safeParse(req.query);
  if (miss || !parsed.success) {
    res.status(400).json({ error: "Bad request", message: `${miss ?? "email"} is required` });
    return;
  }

  const { email } = parsed.data;

  const ownership = await checkAddressOwnership(req, email);
  if (!ownership.ok) {
    res.status(ownership.notFound ? 404 : 403).json({
      error: ownership.notFound ? "Not found" : "Forbidden",
      message: ownership.notFound
        ? "Alamat email tidak ditemukan."
        : "Operasi ini butuh bukti kepemilikan alamat (header X-Manage-Token).",
    });
    return;
  }

  const messages = await db
    .select()
    .from(messagesTable)
    .where(and(eq(messagesTable.email, email), isNotNull(messagesTable.deletedAt)))
    .orderBy(desc(messagesTable.deletedAt));

  const summaries = messages.map((m) => ({
    id: m.id,
    from: m.fromAddress,
    subject: m.subject,
    preview: m.preview,
    receivedAt: m.receivedAt.toISOString(),
    deletedAt: m.deletedAt?.toISOString() ?? null,
    isRead: m.isRead,
    hasAttachments: m.hasAttachments,
    archived: m.archived,
  }));

  res.json({ email, messages: summaries, total: summaries.length });
});

// Undo hapus: kembalikan pesan dari tong sampah ke kotak masuk.
router.post("/message/restore", async (req, res) => {
  const body = (req.body ?? {}) as { id?: unknown; email?: unknown };
  if (typeof body.id !== "string" || !body.id || typeof body.email !== "string" || !body.email) {
    res.status(400).json({ error: "Bad request", message: "id and email are required" });
    return;
  }

  const { id, email } = body as { id: string; email: string };

  const ownership = await checkAddressOwnership(req, email);
  if (!ownership.ok) {
    res.status(ownership.notFound ? 404 : 403).json({
      error: ownership.notFound ? "Not found" : "Forbidden",
      message: ownership.notFound
        ? "Alamat email tidak ditemukan."
        : "Operasi ini butuh bukti kepemilikan alamat (header X-Manage-Token).",
    });
    return;
  }

  const restored = await db
    .update(messagesTable)
    .set({ deletedAt: null })
    .where(and(eq(messagesTable.id, id), eq(messagesTable.email, email), isNotNull(messagesTable.deletedAt)))
    .returning({ id: messagesTable.id });

  if (restored.length === 0) {
    res.status(404).json({ error: "Not found", message: "Message not found in trash" });
    return;
  }

  res.json({ success: true, message: "Message restored" });
});

// Hapus permanen satu pesan DARI TONG SAMPAH (tidak bisa undo).
router.delete("/message/permanent", async (req, res) => {
  const miss = missingQueryParam(req, "id", "email");
  const parsed = GetMessageQueryParams.safeParse(req.query);
  if (miss || !parsed.success || !parsed.data.id || !parsed.data.email) {
    res.status(400).json({ error: "Bad request", message: "id and email are required" });
    return;
  }

  const { id, email } = parsed.data;

  const ownership = await checkAddressOwnership(req, email);
  if (!ownership.ok) {
    res.status(ownership.notFound ? 404 : 403).json({
      error: ownership.notFound ? "Not found" : "Forbidden",
      message: ownership.notFound
        ? "Alamat email tidak ditemukan."
        : "Operasi ini butuh bukti kepemilikan alamat (header X-Manage-Token).",
    });
    return;
  }

  const deleted = await db
    .delete(messagesTable)
    .where(and(eq(messagesTable.id, id), eq(messagesTable.email, email), isNotNull(messagesTable.deletedAt)))
    .returning({ id: messagesTable.id });

  if (deleted.length === 0) {
    res.status(404).json({ error: "Not found", message: "Message not found in trash" });
    return;
  }

  res.json({ success: true, message: "Message permanently deleted" });
});

router.delete("/reset", async (req, res) => {
  const miss = missingQueryParam(req, "email");
  const parsed = ResetInboxQueryParams.safeParse(req.query);
  if (miss || !parsed.success || !parsed.data.email) {
    res.status(400).json({ error: "Bad request", message: "email is required" });
    return;
  }

  const { email } = parsed.data;
  const ownership = await checkAddressOwnership(req, email);
  if (!ownership.ok) {
    res.status(ownership.notFound ? 404 : 403).json({
      error: ownership.notFound ? "Not found" : "Forbidden",
      message: ownership.notFound
        ? "Alamat email tidak ditemukan."
        : "Operasi ini butuh bukti kepemilikan alamat (header X-Manage-Token).",
    });
    return;
  }
  await db.delete(messagesTable).where(eq(messagesTable.email, email));

  res.json({ success: true, message: "Inbox cleared" });
});

// Self-Destruct Burner: Permanently delete email address and all its messages
router.delete("/destroy", async (req, res) => {
  const email = (req.query.email as string || req.body?.email || "").trim().toLowerCase();
  if (!email || !email.includes("@")) {
    res.status(400).json({ error: "Bad request", message: "email is required" });
    return;
  }

  const ownership = await checkAddressOwnership(req, email);
  if (!ownership.ok) {
    res.status(ownership.notFound ? 404 : 403).json({
      error: ownership.notFound ? "Not found" : "Forbidden",
      message: ownership.notFound
        ? "Alamat email tidak ditemukan."
        : "Operasi ini butuh bukti kepemilikan alamat (header X-Manage-Token).",
    });
    return;
  }

  // Cascade delete messages and the address record
  await db.delete(messagesTable).where(eq(messagesTable.email, email));
  await db.delete(emailAddressesTable).where(eq(emailAddressesTable.email, email));

  res.json({ success: true, message: `Email ${email} berhasil dimusnahkan secara permanen.` });
});

router.get("/domains", async (req, res) => {
  const domains = await getActiveDomains();
  const domUserId = req.session?.userId ?? (req as any).apiKeyUserId ?? null;
  if (domUserId) {
    const mine = await getUserCustomDomains(domUserId);
    const merged = [...domains, ...mine.filter((d) => !domains.includes(d))];
    res.json({ domains: merged });
    return;
  }
  res.json({ domains });
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
  const messages = await db.select().from(messagesTable).where(and(eq(messagesTable.email, email), isNull(messagesTable.deletedAt)));
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

  const ownership = await checkAddressOwnership(req, email);
  if (!ownership.ok) {
    res.status(ownership.notFound ? 404 : 403).json({
      error: ownership.notFound ? "Not found" : "Forbidden",
      message: ownership.notFound
        ? "Alamat email tidak ditemukan."
        : "Operasi ini butuh bukti kepemilikan alamat (header X-Manage-Token).",
    });
    return;
  }

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
