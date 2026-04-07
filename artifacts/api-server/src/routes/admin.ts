import { Router } from "express";
import { db } from "@workspace/db";
import { usersTable, emailAddressesTable, messagesTable, siteSettingsTable } from "@workspace/db";
import { eq, count, desc } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { requireAdmin } from "../lib/auth.js";

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

// --- Users ---
router.get("/users", async (_req, res) => {
  const users = await db
    .select()
    .from(usersTable)
    .orderBy(desc(usersTable.createdAt));
  res.json(users.map((u) => ({ id: u.id, email: u.email, role: u.role, createdAt: u.createdAt })));
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
  if (!password || password.length < 6) {
    res.status(400).json({ error: "Bad request", message: "Password minimal 6 karakter." });
    return;
  }
  const passwordHash = await bcrypt.hash(password, 10);
  await db.update(usersTable).set({ passwordHash }).where(eq(usersTable.id, id));
  res.json({ success: true, message: "Password berhasil diubah." });
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

router.get("/settings", async (_req, res) => {
  const rows = await db.select().from(siteSettingsTable);
  const settings: Record<string, string> = { ...DEFAULT_SETTINGS };
  for (const row of rows) {
    settings[row.key] = row.value;
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

export { router as adminRouter };
