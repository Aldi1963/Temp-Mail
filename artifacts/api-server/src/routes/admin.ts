import { Router } from "express";
import { db } from "@workspace/db";
import { usersTable, emailAddressesTable, messagesTable, siteSettingsTable, broadcastsTable, activityLogsTable, blockedDomainsTable } from "@workspace/db";
import { eq, count, desc, gte, gt, sql, and, lt, isNotNull, isNull, ilike, or, inArray } from "drizzle-orm";
import bcrypt from "bcryptjs";
import dns from "dns";
import os from "node:os";
import { execFile } from "node:child_process";
import { promisify } from "util";
import { requireAdmin } from "../lib/auth.js";
import { logActivity } from "../lib/activity.js";

const dnsResolve4 = promisify(dns.resolve4);
const dnsResolveCname = promisify(dns.resolveCname);
const dnsResolveMx = promisify(dns.resolveMx);
const execFileAsync = promisify(execFile);

const router = Router();

router.use(requireAdmin);

// --- Stats ---
router.get("/stats", async (_req, res) => {
  const [userCount] = await db.select({ count: count() }).from(usersTable);
  const [emailCount] = await db.select({ count: count() }).from(emailAddressesTable);
  const [messageCount] = await db.select({ count: count() }).from(messagesTable);

  res.json({
    totalUsers: Number(userCount.count),
    totalEmails: Number(emailCount.count),
    totalMessages: Number(messageCount.count),
  });
});

// --- Detailed Stats ---
router.get("/stats/detail", async (_req, res) => {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterdayStart = new Date(todayStart);
  yesterdayStart.setDate(yesterdayStart.getDate() - 1);
  const sevenDaysAgo = new Date(todayStart);
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
  const prevWeekStart = new Date(todayStart);
  prevWeekStart.setDate(prevWeekStart.getDate() - 13);

  const [[activeCount], [emailsToday], [newUsers], [messagesT], emailsPerDayRaw, messagesPerDayRaw,
    [emailsYesterday], [messagesYesterday], [newUsersPrev], [emailsWeek], [messagesWeek]] = await Promise.all([
    db.select({ count: count() }).from(emailAddressesTable).where(gt(emailAddressesTable.expiresAt, now)),
    db.select({ count: count() }).from(emailAddressesTable).where(gte(emailAddressesTable.createdAt, todayStart)),
    db.select({ count: count() }).from(usersTable).where(gte(usersTable.createdAt, sevenDaysAgo)),
    db.select({ count: count() }).from(messagesTable).where(gte(messagesTable.receivedAt, todayStart)),
    db.execute(sql`SELECT DATE(created_at) as date, COUNT(*)::int as count FROM email_addresses WHERE created_at >= ${sevenDaysAgo} GROUP BY DATE(created_at) ORDER BY date ASC`),
    db.execute(sql`SELECT DATE(received_at) as date, COUNT(*)::int as count FROM messages WHERE received_at >= ${sevenDaysAgo} GROUP BY DATE(received_at) ORDER BY date ASC`),
    // Periode sebelumnya — untuk perbandingan
    db.select({ count: count() }).from(emailAddressesTable).where(and(gte(emailAddressesTable.createdAt, yesterdayStart), lt(emailAddressesTable.createdAt, todayStart))),
    db.select({ count: count() }).from(messagesTable).where(and(gte(messagesTable.receivedAt, yesterdayStart), lt(messagesTable.receivedAt, todayStart))),
    db.select({ count: count() }).from(usersTable).where(and(gte(usersTable.createdAt, prevWeekStart), lt(usersTable.createdAt, sevenDaysAgo))),
    db.select({ count: count() }).from(emailAddressesTable).where(gte(emailAddressesTable.createdAt, sevenDaysAgo)),
    db.select({ count: count() }).from(messagesTable).where(gte(messagesTable.receivedAt, sevenDaysAgo)),
  ]);

  const emailsByDay: Record<string, number> = {};
  const messagesByDay: Record<string, number> = {};
  for (let i = 0; i < 7; i++) {
    const d = new Date(sevenDaysAgo);
    d.setDate(d.getDate() + i);
    // Key tanggal LOKAL server (bukan UTC): toISOString() menggeser ke hari
    // sebelumnya untuk zona UTC+x sehingga grafik kehilangan hari berjalan.
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    emailsByDay[key] = 0;
    messagesByDay[key] = 0;
  }
  for (const r of emailsPerDayRaw.rows as { date: string; count: number }[]) {
    const key = String(r.date).slice(0, 10);
    if (key in emailsByDay) emailsByDay[key] = Number(r.count);
  }
  for (const r of messagesPerDayRaw.rows as { date: string; count: number }[]) {
    const key = String(r.date).slice(0, 10);
    if (key in messagesByDay) messagesByDay[key] = Number(r.count);
  }

  const emailsPerDay = Object.entries(emailsByDay).map(([date, count]) => ({ date, count }));
  const messagesPerDay = Object.entries(messagesByDay).map(([date, count]) => ({ date, count }));

  res.json({
    activeEmails: Number(activeCount.count),
    emailsToday: Number(emailsToday.count),
    newUsersThisWeek: Number(newUsers.count),
    messagesToday: Number(messagesT.count),
    emailsPerDay,
    messagesPerDay,
    // Perbandingan periode
    emailsYesterday: Number(emailsYesterday.count),
    messagesYesterday: Number(messagesYesterday.count),
    newUsersPrevWeek: Number(newUsersPrev.count),
    emailsThisWeek: Number(emailsWeek.count),
    messagesThisWeek: Number(messagesWeek.count),
  });
});

// --- Grafik trafik pesan (N hari terakhir) ---
router.get("/stats/traffic", async (req, res) => {
  const days = Math.min(Math.max(parseInt(String(req.query.days ?? "30"), 10) || 30, 1), 365);
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startDate = new Date(todayStart);
  startDate.setDate(startDate.getDate() - (days - 1));

  const raw = await db.execute(
    sql`SELECT DATE(received_at) as date, COUNT(*)::int as count FROM messages WHERE received_at >= ${startDate} GROUP BY DATE(received_at) ORDER BY date ASC`
  );

  // Key tanggal LOKAL server (bukan UTC): toISOString() menggeser hari
  // untuk zona UTC+x.
  const byDay: Record<string, number> = {};
  for (let i = 0; i < days; i++) {
    const d = new Date(startDate);
    d.setDate(d.getDate() + i);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    byDay[key] = 0;
  }
  for (const r of raw.rows as { date: string; count: number }[]) {
    const key = String(r.date).slice(0, 10);
    if (key in byDay) byDay[key] = Number(r.count);
  }

  res.json(Object.entries(byDay).map(([date, count]) => ({ date, count })));
});

// --- Log aktivitas (admin) ---
router.get("/activity-logs", async (req, res) => {
  const type = typeof req.query.type === "string" ? req.query.type.trim().slice(0, 60) : "";
  const q = typeof req.query.q === "string" ? req.query.q.trim().slice(0, 100) : "";
  const page = Math.max(parseInt(String(req.query.page ?? "1"), 10) || 1, 1);
  const limit = Math.min(Math.max(parseInt(String(req.query.limit ?? "20"), 10) || 20, 1), 100);

  const conds = [];
  if (type) conds.push(ilike(activityLogsTable.action, `%${type.replace(/[%_\\]/g, "\\$&")}%`));
  if (q) {
    const safe = `%${q.replace(/[%_\\]/g, "\\$&")}%`;
    conds.push(or(ilike(activityLogsTable.action, safe), ilike(activityLogsTable.description, safe)));
  }
  const where = conds.length > 0 ? and(...conds) : undefined;

  const [[totalRow], items] = await Promise.all([
    db.select({ count: count() }).from(activityLogsTable).where(where),
    db
      .select()
      .from(activityLogsTable)
      .where(where)
      .orderBy(desc(activityLogsTable.createdAt))
      .limit(limit)
      .offset((page - 1) * limit),
  ]);

  let actorEmail: Record<number, string> = {};
  const userIds = [...new Set(items.map((i) => i.userId).filter((u): u is number => u !== null))];
  if (userIds.length > 0) {
    const users = await db
      .select({ id: usersTable.id, email: usersTable.email })
      .from(usersTable)
      .where(inArray(usersTable.id, userIds));
    for (const u of users) actorEmail[u.id] = u.email;
  }

  res.json({
    items: items.map((l) => {
      let metadata: unknown = {};
      try { metadata = JSON.parse(l.metadata); } catch { /* abaikan */ }
      return {
        id: l.id,
        userId: l.userId,
        actorEmail: l.userId !== null ? actorEmail[l.userId] ?? null : null,
        action: l.action,
        description: l.description,
        metadata,
        createdAt: l.createdAt,
      };
    }),
    total: Number(totalRow.count),
    page,
    limit,
  });
});

// --- Blokir domain global (admin) ---
router.get("/blocked-domains", async (_req, res) => {
  const rows = await db
    .select()
    .from(blockedDomainsTable)
    .orderBy(desc(blockedDomainsTable.createdAt));
  res.json({
    blockedDomains: rows.map((r) => ({
      id: r.id,
      domain: r.domain,
      reason: r.reason,
      createdBy: r.createdBy,
      createdAt: r.createdAt,
    })),
  });
});

router.post("/blocked-domains", async (req, res) => {
  const { domain, reason } = req.body ?? {};
  const cleanDomain =
    typeof domain === "string" ? domain.trim().toLowerCase().replace(/^@/, "") : "";
  if (!cleanDomain || !/^[a-z0-9.-]+\.[a-z]{2,}$/.test(cleanDomain)) {
    res.status(400).json({ error: "Bad request", message: "Domain tidak valid." });
    return;
  }
  const cleanReason = typeof reason === "string" ? reason.trim().slice(0, 200) : null;
  try {
    const [row] = await db
      .insert(blockedDomainsTable)
      .values({ domain: cleanDomain, reason: cleanReason, createdBy: req.session.userId ?? null })
      .returning();
    await logActivity({
      userId: req.session.userId ?? null,
      action: "admin.domain_block",
      description: `Admin memblokir domain ${cleanDomain}`,
      metadata: { domain: cleanDomain, reason: cleanReason },
    });
    res.status(201).json({ success: true, id: row.id, domain: row.domain });
  } catch (e: any) {
    if (e?.code === "23505") {
      res.status(409).json({ error: "Conflict", message: "Domain ini sudah diblokir." });
      return;
    }
    throw e;
  }
});

router.delete("/blocked-domains/:id", async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const deleted = await db
    .delete(blockedDomainsTable)
    .where(eq(blockedDomainsTable.id, id))
    .returning({ id: blockedDomainsTable.id, domain: blockedDomainsTable.domain });
  if (deleted.length === 0) {
    res.status(404).json({ error: "Not found", message: "Domain tidak ditemukan." });
    return;
  }
  await logActivity({
    userId: req.session.userId ?? null,
    action: "admin.domain_unblock",
    description: `Admin membuka blokir domain ${deleted[0].domain}`,
    metadata: { domain: deleted[0].domain },
  });
  res.json({ success: true });
});

// --- Users ---
router.get("/users", async (_req, res) => {
  const users = await db
    .select()
    .from(usersTable)
    .orderBy(desc(usersTable.createdAt));
  const emailCounts = await db
    .select({ userId: emailAddressesTable.userId, count: count() })
    .from(emailAddressesTable)
    .where(isNotNull(emailAddressesTable.userId))
    .groupBy(emailAddressesTable.userId);
  const msgCounts = await db
    .select({ userId: emailAddressesTable.userId, count: count() })
    .from(messagesTable)
    .innerJoin(emailAddressesTable, eq(messagesTable.email, emailAddressesTable.email))
    .where(and(isNotNull(emailAddressesTable.userId), isNull(messagesTable.deletedAt)))
    .groupBy(emailAddressesTable.userId);
  const eMap = new Map(emailCounts.map((r) => [r.userId, Number(r.count)]));
  const mMap = new Map(msgCounts.map((r) => [r.userId, Number(r.count)]));
  res.json(users.map((u) => ({
    id: u.id,
    email: u.email,
    role: u.role,
    suspended: u.suspended ?? false,
    createdAt: u.createdAt,
    emailCount: eMap.get(u.id) ?? 0,
    messageCount: mMap.get(u.id) ?? 0,
  })));
});

router.post("/users", async (req, res) => {
  const { email, password, role } = req.body ?? {};
  const cleanEmail = String(email ?? "").toLowerCase().trim();
  if (!cleanEmail || !cleanEmail.includes("@")) {
    res.status(400).json({ error: "Bad request", message: "Email tidak valid." });
    return;
  }
  if (!password || String(password).length < 8) {
    res.status(400).json({ error: "Bad request", message: "Password minimal 8 karakter." });
    return;
  }
  const cleanRole = role === "admin" ? "admin" : "user";
  const passwordHash = await bcrypt.hash(String(password), 10);
  try {
    const [u] = await db
      .insert(usersTable)
      .values({ email: cleanEmail, passwordHash, role: cleanRole })
      .returning({ id: usersTable.id, email: usersTable.email, role: usersTable.role, createdAt: usersTable.createdAt });
    res.status(201).json({ success: true, message: "Pengguna berhasil dibuat.", user: { ...u, suspended: false, emailCount: 0, messageCount: 0 } });
  } catch (e: any) {
    if (e?.code === "23505") {
      res.status(409).json({ error: "Conflict", message: "Email sudah terdaftar." });
      return;
    }
    throw e;
  }
});

router.patch("/users/:id/role", async (req, res) => {
  const id = parseInt(req.params.id);
  const { role } = req.body ?? {};
  if (!["user", "admin"].includes(role)) {
    res.status(400).json({ error: "Bad request", message: "Role harus 'user' atau 'admin'." });
    return;
  }
  await db.update(usersTable).set({ role }).where(eq(usersTable.id, id));
  res.json({ success: true, message: `Role berhasil diubah ke ${role}.` });
});

router.patch("/users/:id/suspend", async (req, res) => {
  const id = parseInt(req.params.id);
  const { suspended } = req.body ?? {};
  if (typeof suspended !== "boolean") {
    res.status(400).json({ error: "Bad request", message: "Nilai suspended harus boolean." });
    return;
  }
  const selfId = req.session.userId;
  if (id === selfId) {
    res.status(400).json({ error: "Bad request", message: "Tidak bisa menonaktifkan akun sendiri." });
    return;
  }
  await db.update(usersTable).set({ suspended }).where(eq(usersTable.id, id));
  if (suspended) {
    // [SECURITY] Akhiri semua sesi aktif user yang dinonaktifkan
    await db.execute(sql`DELETE FROM user_sessions WHERE (sess::jsonb ->> 'userId') = ${String(id)}`);
  }
  await logActivity({
    userId: req.session.userId ?? null,
    action: suspended ? "admin.user_suspend" : "admin.user_unsuspend",
    description: `Admin ${suspended ? "menonaktifkan" : "mengaktifkan kembali"} user #${id}`,
    metadata: { targetUserId: id, suspended },
  });
  res.json({ success: true, message: suspended ? "Pengguna dinonaktifkan." : "Pengguna diaktifkan kembali." });
});

router.delete("/users/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  const selfId = req.session.userId;
  if (id === selfId) {
    res.status(400).json({ error: "Bad request", message: "Tidak bisa menghapus akun sendiri." });
    return;
  }
  await db.delete(usersTable).where(eq(usersTable.id, id));
  res.json({ success: true, message: "Pengguna berhasil dihapus." });
});

router.patch("/users/:id/password", async (req, res) => {
  const id = parseInt(req.params.id);
  const { password } = req.body ?? {};
  if (!password || password.length < 8) {
    res.status(400).json({ error: "Bad request", message: "Password minimal 8 karakter." });
    return;
  }
  const passwordHash = await bcrypt.hash(password, 10);
  await db.update(usersTable).set({ passwordHash }).where(eq(usersTable.id, id));
  // [SECURITY] Invalidasi semua sesi aktif user agar password lama tidak bisa dipakai lagi
  await db.execute(sql`DELETE FROM user_sessions WHERE (sess::jsonb ->> 'userId') = ${String(id)}`);
  res.json({ success: true, message: "Password berhasil diubah. Semua sesi aktif user telah diakhiri." });
});

// --- Site Settings ---
const DEFAULT_SETTINGS: Record<string, string> = {
  // Umum
  site_name: "TempMail",
  default_ttl_minutes: "10",
  max_inboxes: "5",
  available_domains: '["tmpmail.dev","quickmail.io","throwaway.net"]',
  allow_registration: "true",
  maintenance_mode: "false",
  max_message_size_kb: "1024",
  // Branding & SEO
  site_description: "Layanan email sementara gratis. Buat alamat email sekali pakai secara instan.",
  site_logo_url: "",
  site_favicon_url: "",
  meta_title: "TempMail - Email Sementara Gratis",
  meta_keywords: "email sementara, temporary email, disposable email, temp mail",
  footer_text: "© 2025 TempMail. Semua hak cipta dilindungi.",
  // Fitur
  require_login_to_generate: "false",
  max_emails_per_day: "50",
  show_qr_by_default: "false",
  auto_copy_on_generate: "true",
  // Pengumuman
  announcement_enabled: "false",
  announcement_text: "",
  announcement_type: "info",
};

// Key yang tidak boleh dikembalikan plaintext ke client (meski admin)
const SENSITIVE_SETTING_KEYS = new Set(["telegram_bot_token", "inbound_webhook_secret"]);
const MASKED_SECRET = "\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022";

router.get("/settings", async (_req, res) => {
  const rows = await db.select().from(siteSettingsTable);
  const settings: Record<string, string> = { ...DEFAULT_SETTINGS };
  for (const row of rows) {
    settings[row.key] = SENSITIVE_SETTING_KEYS.has(row.key) && row.value ? MASKED_SECRET : row.value;
  }
  res.json(settings);
});

router.put("/settings", async (req, res) => {
  const updates = req.body as Record<string, string>;
  if (!updates || typeof updates !== "object") {
    res.status(400).json({ error: "Bad request", message: "Body harus berupa objek key-value." });
    return;
  }
  for (const [key, value] of Object.entries(updates)) {
    // Jangan timpa secret asli bila client mengirim kembali nilai mask
    if (SENSITIVE_SETTING_KEYS.has(key) && value === MASKED_SECRET) continue;
    await db
      .insert(siteSettingsTable)
      .values({ key, value, updatedAt: new Date() })
      .onConflictDoUpdate({ target: siteSettingsTable.key, set: { value, updatedAt: new Date() } });
  }
  res.json({ success: true, message: "Pengaturan berhasil disimpan." });
});

router.patch("/settings/:key", async (req, res) => {
  const { key } = req.params;
  const { value } = req.body ?? {};
  if (value === undefined) {
    res.status(400).json({ error: "Bad request", message: "value wajib diisi." });
    return;
  }
  await db
    .insert(siteSettingsTable)
    .values({ key, value: String(value), updatedAt: new Date() })
    .onConflictDoUpdate({ target: siteSettingsTable.key, set: { value: String(value), updatedAt: new Date() } });
  res.json({ success: true, message: `Setting '${key}' berhasil diperbarui.` });
});

// --- DNS Check ---
router.get("/dns-check", async (req, res) => {
  const domain = (req.query.domain as string || "").trim().toLowerCase();
  if (!domain || !domain.includes(".")) {
    res.status(400).json({ error: "Bad request", message: "Domain tidak valid." });
    return;
  }

  const result: {
    domain: string;
    a: string[];
    cname: string[];
    mx: { exchange: string; priority: number }[];
    status: "ok" | "partial" | "error";
    summary: string;
  } = { domain, a: [], cname: [], mx: [], status: "error", summary: "" };

  // Tiap lookup dibatasi 8 detik agar request tidak menggantung selamanya
  // bila resolver DNS tidak merespons (dulu: tanpa timeout sama sekali).
  const withTimeout = <T,>(p: Promise<T>, ms: number): Promise<T> =>
    Promise.race([
      p,
      new Promise<T>((_, reject) => setTimeout(() => reject(new Error("DNS lookup timeout")), ms)),
    ]);

  await Promise.allSettled([
    withTimeout(dnsResolve4(domain), 8000).then((r) => { result.a = r; }).catch(() => {}),
    withTimeout(dnsResolveCname(domain), 8000).then((r) => { result.cname = r; }).catch(() => {}),
    withTimeout(dnsResolveMx(domain), 8000).then((r) => { result.mx = r.map(m => ({ exchange: m.exchange, priority: m.priority })); }).catch(() => {}),
  ]);

  if (result.a.length > 0 || result.cname.length > 0) {
    result.status = "ok";
    result.summary = `Domain ditemukan. ${result.a.length > 0 ? `A record: ${result.a.join(", ")}` : `CNAME: ${result.cname.join(", ")}`}`;
  } else if (result.mx.length > 0) {
    result.status = "partial";
    result.summary = "MX record ditemukan, tapi A/CNAME belum terdaftar.";
  } else {
    result.status = "error";
    result.summary = "Tidak ada DNS record yang ditemukan untuk domain ini.";
  }

  res.json(result);
});

// --- Broadcast admin ---
// FCM belum dikonfigurasi: broadcast hanya disimpan sebagai riwayat,
// belum dikirim ke perangkat mana pun (fcmSent selalu false).
router.post("/broadcast", async (req, res) => {
  const { title, body } = req.body ?? {};
  const cleanTitle = String(title ?? "").trim();
  const cleanBody = String(body ?? "").trim();
  if (!cleanTitle) {
    res.status(400).json({ error: "Bad request", message: "Judul wajib diisi." });
    return;
  }
  if (cleanTitle.length > 100) {
    res.status(400).json({ error: "Bad request", message: "Judul maksimal 100 karakter." });
    return;
  }
  if (!cleanBody) {
    res.status(400).json({ error: "Bad request", message: "Isi pesan wajib diisi." });
    return;
  }
  if (cleanBody.length > 500) {
    res.status(400).json({ error: "Bad request", message: "Isi pesan maksimal 500 karakter." });
    return;
  }
  const [row] = await db
    .insert(broadcastsTable)
    .values({ title: cleanTitle, body: cleanBody, createdBy: req.session.userId ?? null })
    .returning({ id: broadcastsTable.id });
  await logActivity({
    userId: req.session.userId ?? null,
    action: "admin.broadcast",
    description: `Admin mengirim broadcast: ${cleanTitle}`,
    metadata: { broadcastId: row.id, title: cleanTitle },
  });
  res.status(201).json({
    success: true,
    id: row.id,
    fcmSent: false,
    message: "tersimpan, FCM belum aktif",
  });
});

router.get("/broadcasts", async (_req, res) => {
  const rows = await db
    .select()
    .from(broadcastsTable)
    .orderBy(desc(broadcastsTable.createdAt))
    .limit(20);
  res.json(rows.map((b) => ({
    id: b.id,
    title: b.title,
    body: b.body,
    createdBy: b.createdBy,
    createdAt: b.createdAt,
    fcmSent: b.fcmSent ?? false,
  })));
});

// --- Monitor server ---
// Setiap bagian dibungkus try/catch sendiri: bila satu metrik gagal,
// nilainya null, bukan 500.
router.get("/server", async (_req, res) => {
  // Format durasi detik ke bahasa Indonesia yang mudah dibaca
  const formatDurasi = (totalDetik: number): string => {
    const d = Math.floor(totalDetik / 86400);
    const h = Math.floor((totalDetik % 86400) / 3600);
    const m = Math.floor((totalDetik % 3600) / 60);
    const s = totalDetik % 60;
    const bagian: string[] = [];
    if (d > 0) bagian.push(`${d} hari`);
    if (h > 0) bagian.push(`${h} jam`);
    if (m > 0) bagian.push(`${m} menit`);
    if (s > 0 || bagian.length === 0) bagian.push(`${s} detik`);
    return bagian.join(" ");
  };

  // CPU: load average 1m/5m/15m + jumlah core
  let cpu: { load1m: number; load5m: number; load15m: number; cores: number } | null = null;
  try {
    const [load1m, load5m, load15m] = os.loadavg();
    cpu = {
      load1m: Math.round(load1m * 100) / 100,
      load5m: Math.round(load5m * 100) / 100,
      load15m: Math.round(load15m * 100) / 100,
      cores: os.cpus().length,
    };
  } catch {
    cpu = null;
  }

  // Memori: MB + persen terpakai
  let mem: { totalMB: number; freeMB: number; usedMB: number; usedPercent: number } | null = null;
  try {
    const totalMB = Math.round(os.totalmem() / 1024 / 1024);
    const freeMB = Math.round(os.freemem() / 1024 / 1024);
    const usedMB = totalMB - freeMB;
    mem = {
      totalMB,
      freeMB,
      usedMB,
      usedPercent: totalMB > 0 ? Math.round((usedMB / totalMB) * 100) : 0,
    };
  } catch {
    mem = null;
  }

  // Disk: parse `df -k /` -> GB + persen
  let disk: { totalGB: number; usedGB: number; availGB: number; usedPercent: number } | null = null;
  try {
    const { stdout } = await execFileAsync("df", ["-k", "/"], { timeout: 5000 });
    const baris = stdout.trim().split("\n").find((l) => l.trim().split(/\s+/).pop() === "/");
    if (baris) {
      // Kolom: Filesystem | 1K-blocks | Used | Available | Use% | Mounted on
      const kolom = baris.trim().split(/\s+/);
      const totalKB = Number(kolom[1]);
      const usedKB = Number(kolom[2]);
      const availKB = Number(kolom[3]);
      if ([totalKB, usedKB, availKB].every((n) => Number.isFinite(n) && n >= 0)) {
        const keGB = (kb: number) => Math.round((kb / 1024 / 1024) * 100) / 100;
        disk = {
          totalGB: keGB(totalKB),
          usedGB: keGB(usedKB),
          availGB: keGB(availKB),
          usedPercent: totalKB > 0 ? Math.round((usedKB / totalKB) * 100) : 0,
        };
      }
    }
  } catch {
    disk = null;
  }

  // Uptime: detik + format manusiawi
  let uptime: { seconds: number; human: string } | null = null;
  try {
    const seconds = Math.floor(os.uptime());
    uptime = { seconds, human: formatDurasi(seconds) };
  } catch {
    uptime = null;
  }

  // Ukuran database (Postgres)
  let dbInfo: { sizeBytes: number; sizeMB: number } | null = null;
  try {
    const hasil = await db.execute(sql`SELECT pg_database_size(current_database()) AS size`);
    const sizeBytes = Number((hasil.rows[0] as { size: string }).size);
    if (Number.isFinite(sizeBytes)) {
      dbInfo = { sizeBytes, sizeMB: Math.round((sizeBytes / 1024 / 1024) * 100) / 100 };
    }
  } catch {
    dbInfo = null;
  }

  res.json({
    cpu,
    mem,
    disk,
    uptime,
    db: dbInfo,
    time: new Date().toISOString(),
  });
});

export { router as adminRouter };
