import { Router } from "express";
import { db } from "@workspace/db";
import { emailAddressesTable, messagesTable, activityLogsTable, usersTable,
  telegramLinkTokensTable } from "@workspace/db";
import { eq, desc, count, and, isNull, gt } from "drizzle-orm";
import { createHash, timingSafeEqual, randomBytes } from "crypto";
import { requireAuth, requireAuthOrApiKey } from "../lib/auth.js";
import { siteSettingsTable } from "@workspace/db";

const router = Router();

// ---------------------------------------------------------------------------
// PATCH /emails/label — sengaja didaftarkan SEBELUM requireAuthOrApiKey agar
// tamu (guest, tanpa login) juga bisa mengatur label alamatnya dengan bukti
// kepemilikan X-Manage-Token (pola yang sama dengan routes/email.ts).
// Penegakan auth dilakukan manual di dalam handler:
//   1. user login (session/API key) yang memiliki alamat -> diizinkan
//      (perilaku lama, tidak berubah);
//   2. guest dengan X-Manage-Token (atau ?manageToken=) yang valid -> diizinkan;
//   3. alamat guest legacy (tanpa manageTokenHash & tanpa userId) -> diizinkan,
//      sama seperti checkAddressOwnership di routes/email.ts.
// ---------------------------------------------------------------------------

/** Ambil manage token dari header X-Manage-Token atau query ?manageToken=. */
function readManageToken(req: { headers: Record<string, unknown>; query: Record<string, unknown> }): string {
  const h = req.headers["x-manage-token"];
  const fromHeader = typeof h === "string" ? h : "";
  const q = req.query.manageToken;
  const fromQuery = typeof q === "string" ? q : "";
  return (fromHeader || fromQuery || "").trim();
}

/** Cocokkan manage token dengan hash SHA-256 yang tersimpan (timing-safe). */
function manageTokenMatches(provided: string, storedHash: string): boolean {
  const a = Buffer.from(createHash("sha256").update(provided, "utf8").digest("hex"), "utf8");
  const b = Buffer.from(storedHash, "utf8");
  return a.length === b.length && timingSafeEqual(a, b);
}

router.patch("/emails/label", async (req, res) => {
  const userId = req.session?.userId ?? req.apiKeyUserId;
  const { email, label } = req.body ?? {};
  if (!email || typeof email !== "string") {
    res.status(400).json({ error: "Bad request", message: "email wajib diisi." });
    return;
  }
  const cleanEmail = email.trim().toLowerCase();
  const cleanLabel = typeof label === "string" ? label.trim().slice(0, 40) : "";
  const rows = await db
    .select()
    .from(emailAddressesTable)
    .where(eq(emailAddressesTable.email, cleanEmail))
    .limit(1);
  if (rows.length === 0) {
    res.status(404).json({ error: "Not found", message: "Alamat tidak ditemukan." });
    return;
  }
  const addr = rows[0];

  // 1. Pemilik yang login — perilaku lama, tidak berubah.
  const isOwner = !!userId && addr.userId === userId;
  // 2. Guest dengan manage token yang valid.
  const providedToken = readManageToken(req);
  const tokenOk =
    !!providedToken &&
    !!addr.manageTokenHash &&
    manageTokenMatches(providedToken, addr.manageTokenHash);
  // 3. Alamat guest legacy (dibuat sebelum fitur token, tanpa pemilik).
  const legacyGuest = !addr.manageTokenHash && !addr.userId;

  if (!isOwner && !tokenOk && !legacyGuest) {
    if (userId) {
      res.status(403).json({ error: "Forbidden", message: "Alamat ini bukan milik akun Anda." });
      return;
    }
    if (providedToken) {
      res.status(403).json({ error: "Forbidden", message: "Bukti kepemilikan tidak valid." });
      return;
    }
    res.status(401).json({
      error: "Unauthorized",
      message: "Silakan login, sertakan X-API-Key, atau X-Manage-Token.",
    });
    return;
  }

  await db
    .update(emailAddressesTable)
    .set({ label: cleanLabel || null })
    .where(eq(emailAddressesTable.email, cleanEmail));
  res.json({ email: cleanEmail, label: cleanLabel || null });
});

router.use(requireAuthOrApiKey);

router.get("/emails", async (req, res) => {
  const userId = req.session.userId ?? req.apiKeyUserId!;
  const emails = await db
    .select()
    .from(emailAddressesTable)
    .where(eq(emailAddressesTable.userId, userId))
    .orderBy(desc(emailAddressesTable.createdAt));

  const result = await Promise.all(
    emails.map(async (e) => {
      const [msgCount] = await db.select({ count: count() }).from(messagesTable).where(and(eq(messagesTable.email, e.email), isNull(messagesTable.deletedAt)));
      return {
        email: e.email,
        domain: e.domain,
        label: e.label ?? null,
        autoDeleteDays: e.autoDeleteDays ?? null,
        createdAt: e.createdAt,
        expiresAt: e.expiresAt,
        isExpired: e.expiresAt < new Date(),
        messageCount: Number(msgCount.count),
      };
    })
  );

  res.json({ emails: result });
});

router.get("/stats", async (req, res) => {
  const userId = req.session.userId ?? req.apiKeyUserId!;
  const emails = await db.select().from(emailAddressesTable).where(eq(emailAddressesTable.userId, userId));

  let totalMessages = 0;
  for (const e of emails) {
    const [row] = await db.select({ count: count() }).from(messagesTable).where(and(eq(messagesTable.email, e.email), isNull(messagesTable.deletedAt)));
    totalMessages += Number(row.count);
  }

  res.json({
    totalEmails: emails.length,
    totalMessages,
    activeEmails: emails.filter((e) => e.expiresAt > new Date()).length,
  });
});

router.get("/activity", requireAuth, async (req, res) => {
  const userId = req.session.userId ?? req.apiKeyUserId!;
  const limit = Math.min(Number(req.query.limit) || 20, 50);

  const logs = await db
    .select()
    .from(activityLogsTable)
    .where(eq(activityLogsTable.userId, userId))
    .orderBy(desc(activityLogsTable.createdAt))
    .limit(limit);

  res.json({
    activities: logs.map((l) => ({
      id: l.id,
      action: l.action,
      description: l.description,
      metadata: JSON.parse(l.metadata),
      createdAt: l.createdAt,
    })),
  });
});

// --- Tautan Telegram (deep link bot) ------------------------------------------
// Status tautan Telegram akun yang sedang login.
router.get("/telegram", requireAuth, async (req, res) => {
  const userId = req.session.userId ?? req.apiKeyUserId!;
  const [u] = await db
    .select({ telegramChatId: usersTable.telegramChatId, telegramUsername: usersTable.telegramUsername })
    .from(usersTable)
    .where(eq(usersTable.id, userId))
    .limit(1);
  res.json({ linked: !!u?.telegramChatId, username: u?.telegramUsername ?? null });
});

// Buat deep link t.me/<bot>?start=<token> untuk menautkan akun ke bot Telegram.
// Token kedaluwarsa 15 menit dan sekali pakai.
router.post("/telegram/link", requireAuth, async (req, res) => {
  const userId = req.session.userId ?? req.apiKeyUserId!;

  const settingsRows = await db.select().from(siteSettingsTable);
  const settingsMap: Record<string, string> = {};
  for (const r of settingsRows) settingsMap[r.key] = r.value;
  const tgToken = settingsMap.telegram_bot_token || process.env.TELEGRAM_BOT_TOKEN;

  if (!tgToken) {
    res.status(503).json({
      error: "Unavailable",
      message: "Bot Telegram belum dikonfigurasi di server (butuh env TELEGRAM_BOT_TOKEN).",
    });
    return;
  }

  let botUsername: string | null = null;
  try {
    const meResp = await fetch(`https://api.telegram.org/bot${tgToken}/getMe`, {
      signal: AbortSignal.timeout(10000),
    });
    const meJson = (await meResp.json()) as { ok?: boolean; result?: { username?: string } };
    botUsername = meJson?.result?.username ?? null;
  } catch {
    botUsername = null;
  }
  if (!botUsername) {
    res.status(503).json({
      error: "Unavailable",
      message: "Gagal membaca identitas bot Telegram. Periksa TELEGRAM_BOT_TOKEN di server.",
    });
    return;
  }

  const token = randomBytes(24).toString("hex");
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

  // Hapus token lama yang belum dipakai agar hanya satu yang aktif.
  await db.delete(telegramLinkTokensTable).where(eq(telegramLinkTokensTable.userId, userId));
  await db.insert(telegramLinkTokensTable).values({ userId, token, expiresAt });

  res.json({ url: `https://t.me/${botUsername}?start=${token}` });
});

// Putuskan tautan Telegram dari akun.
router.delete("/telegram", requireAuth, async (req, res) => {
  const userId = req.session.userId ?? req.apiKeyUserId!;
  await db
    .update(usersTable)
    .set({ telegramChatId: null, telegramUsername: null })
    .where(eq(usersTable.id, userId));
  await db.delete(telegramLinkTokensTable).where(eq(telegramLinkTokensTable.userId, userId));
  res.json({ success: true, message: "Tautan Telegram berhasil diputus." });
});

// Update Telegram Chat ID for logged in user
router.patch("/telegram", requireAuth, async (req, res) => {
  const userId = req.session.userId ?? req.apiKeyUserId!;
  const { chatId } = req.body ?? {};

  const cleanChatId = chatId ? String(chatId).trim() : null;

  await db
    .update(usersTable)
    .set({ telegramChatId: cleanChatId })
    .where(eq(usersTable.id, userId));

  res.json({
    success: true,
    message: cleanChatId
      ? "Telegram Chat ID berhasil disimpan."
      : "Notifikasi Telegram dinonaktifkan.",
    telegramChatId: cleanChatId,
  });
});

// Klaim alamat guest (dibuat tanpa login) ke akun yang sedang login.
// Bukti kepemilikan: manage token yang diterbitkan saat alamat dibuat
// (/generate -> manageToken, disimpan di localStorage browser).
// Alamat legacy tanpa manageTokenHash tetap bisa diklaim (tidak ada
// bukti yang bisa diverifikasi, tapi alamatnya acak & rahasia).
router.post("/emails/claim", async (req, res) => {
  const userId = req.session.userId ?? req.apiKeyUserId!;
  const { email, manageToken } = req.body ?? {};
  if (!email || typeof email !== "string") {
    res.status(400).json({ error: "Bad request", message: "email wajib diisi." });
    return;
  }
  const cleanEmail = email.trim().toLowerCase();
  const rows = await db
    .select()
    .from(emailAddressesTable)
    .where(eq(emailAddressesTable.email, cleanEmail))
    .limit(1);
  if (rows.length === 0) {
    res.status(404).json({ error: "Not found", message: "Alamat tidak ditemukan (mungkin sudah kedaluwarsa)." });
    return;
  }
  const addr = rows[0];
  if (addr.expiresAt < new Date()) {
    res.status(410).json({ error: "Gone", message: "Alamat sudah kedaluwarsa." });
    return;
  }
  if (addr.userId === userId) {
    res.json({ email: addr.email, claimed: false, message: "Alamat ini sudah milik akun Anda." });
    return;
  }
  if (addr.userId && addr.userId !== userId) {
    res.status(403).json({ error: "Forbidden", message: "Alamat ini milik akun lain." });
    return;
  }
  if (addr.manageTokenHash) {
    const tokenOk =
      typeof manageToken === "string" &&
      manageToken.length > 0 &&
      (() => {
        const a = Buffer.from(createHash("sha256").update(manageToken, "utf8").digest("hex"), "utf8");
        const b = Buffer.from(addr.manageTokenHash as string, "utf8");
        return a.length === b.length && timingSafeEqual(a, b);
      })();
    if (!tokenOk) {
      res.status(403).json({ error: "Forbidden", message: "Bukti kepemilikan tidak valid." });
      return;
    }
  }
  await db
    .update(emailAddressesTable)
    .set({ userId })
    .where(eq(emailAddressesTable.email, addr.email));
  res.json({ email: addr.email, claimed: true, message: "Alamat berhasil ditautkan ke akun Anda." });
});

// Lepas alamat dari akun (hapus dari daftar milik user).
// Alamat & pesannya tetap ada di server; hanya kepemilikan (user_id) yang
// dihapus sehingga alamat tidak muncul lagi di daftar setelah reload/login.
router.delete("/emails", async (req, res) => {
  const userId = req.session.userId ?? req.apiKeyUserId!;
  const { email } = req.body ?? {};
  if (!email || typeof email !== "string") {
    res.status(400).json({ error: "Bad request", message: "email wajib diisi." });
    return;
  }
  const cleanEmail = email.trim().toLowerCase();
  const rows = await db
    .select()
    .from(emailAddressesTable)
    .where(eq(emailAddressesTable.email, cleanEmail))
    .limit(1);
  if (rows.length === 0) {
    res.status(404).json({ error: "Not found", message: "Alamat tidak ditemukan." });
    return;
  }
  const addr = rows[0];
  if (addr.userId !== userId) {
    res.status(403).json({ error: "Forbidden", message: "Alamat ini bukan milik akun Anda." });
    return;
  }
  await db
    .update(emailAddressesTable)
    .set({ userId: null })
    .where(eq(emailAddressesTable.email, addr.email));
  res.json({ email: addr.email, removed: true, message: "Alamat dihapus dari daftar akun Anda." });
});

// Atur retensi hapus pesan otomatis per alamat (dalam hari).
// autoDeleteDays: null = fitur mati, atau salah satu dari 1/7/30.
// Pesan yang received_at-nya lebih tua dari N hari akan dihapus permanen
// oleh scheduler tiap 1 jam (lihat lib/cleanup.ts).
router.patch("/emails/retention", async (req, res) => {
  const userId = req.session.userId ?? req.apiKeyUserId!;
  const { email, autoDeleteDays } = req.body ?? {};
  if (!email || typeof email !== "string") {
    res.status(400).json({ error: "Bad request", message: "email wajib diisi." });
    return;
  }
  const cleanEmail = email.trim().toLowerCase();
  const days =
    autoDeleteDays === null || autoDeleteDays === undefined
      ? null
      : Number(autoDeleteDays);
  if (days !== null && ![1, 7, 30].includes(days)) {
    res.status(400).json({
      error: "Bad request",
      message: "autoDeleteDays harus null atau salah satu dari 1, 7, 30.",
    });
    return;
  }
  const rows = await db
    .select()
    .from(emailAddressesTable)
    .where(eq(emailAddressesTable.email, cleanEmail))
    .limit(1);
  if (rows.length === 0) {
    res.status(404).json({ error: "Not found", message: "Alamat tidak ditemukan." });
    return;
  }
  if (rows[0].userId !== userId) {
    res.status(403).json({ error: "Forbidden", message: "Alamat ini bukan milik akun Anda." });
    return;
  }
  await db
    .update(emailAddressesTable)
    .set({ autoDeleteDays: days })
    .where(eq(emailAddressesTable.email, cleanEmail));
  res.json({ email: cleanEmail, autoDeleteDays: days });
});

export { router as userRouter };
