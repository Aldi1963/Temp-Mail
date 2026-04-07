import { Router } from "express";
import { randomBytes } from "crypto";
import { db } from "@workspace/db";
import { usersTable, userTwoFactorTable } from "@workspace/db";
import { eq, count } from "drizzle-orm";
import bcrypt from "bcryptjs";
import speakeasy from "speakeasy";
import QRCode from "qrcode";
import { requireAuth } from "../lib/auth.js";

declare module "express-session" {
  interface SessionData {
    pending2fa?: { userId: number; userRole: string };
  }
}

const router = Router();

router.post("/register", async (req, res) => {
  const { email, password } = req.body ?? {};

  if (!email || !password) {
    res.status(400).json({ error: "Bad request", message: "Email dan password wajib diisi." });
    return;
  }

  if (typeof password !== "string" || password.length < 6) {
    res.status(400).json({ error: "Bad request", message: "Password minimal 6 karakter." });
    return;
  }

  const existing = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.email, email.toLowerCase()))
    .limit(1);
  if (existing.length > 0) {
    res.status(409).json({ error: "Conflict", message: "Email sudah terdaftar." });
    return;
  }

  const [{ total }] = await db.select({ total: count() }).from(usersTable);
  const isFirstUser = Number(total) === 0;

  const passwordHash = await bcrypt.hash(password, 10);
  const [user] = await db
    .insert(usersTable)
    .values({
      email: email.toLowerCase().trim(),
      passwordHash,
      role: isFirstUser ? "admin" : "user",
    })
    .returning();

  req.session.userId = user.id;
  req.session.userRole = user.role;

  res.json({ id: user.id, email: user.email, role: user.role, createdAt: user.createdAt });
});

router.post("/login", async (req, res) => {
  const { email, password } = req.body ?? {};

  if (!email || !password) {
    res.status(400).json({ error: "Bad request", message: "Email dan password wajib diisi." });
    return;
  }

  const results = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.email, email.toLowerCase().trim()))
    .limit(1);
  if (results.length === 0) {
    res.status(401).json({ error: "Unauthorized", message: "Email atau password salah." });
    return;
  }

  const user = results[0];
  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    res.status(401).json({ error: "Unauthorized", message: "Email atau password salah." });
    return;
  }

  const tfa = await db
    .select()
    .from(userTwoFactorTable)
    .where(eq(userTwoFactorTable.userId, user.id))
    .limit(1);

  if (tfa.length > 0 && tfa[0].enabled) {
    req.session.pending2fa = { userId: user.id, userRole: user.role };
    res.json({ requires2fa: true });
    return;
  }

  req.session.userId = user.id;
  req.session.userRole = user.role;

  res.json({ id: user.id, email: user.email, role: user.role, createdAt: user.createdAt });
});

router.post("/logout", (req, res) => {
  req.session.destroy(() => {
    res.clearCookie("tempmail.sid");
    res.json({ success: true, message: "Berhasil logout." });
  });
});

router.get("/me", requireAuth, async (req, res) => {
  const results = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, req.session.userId!))
    .limit(1);
  if (results.length === 0) {
    req.session.destroy(() => {});
    res.status(401).json({ error: "Unauthorized", message: "Sesi tidak valid." });
    return;
  }
  const user = results[0];
  res.json({ id: user.id, email: user.email, role: user.role, createdAt: user.createdAt });
});

// ─── 2FA ─────────────────────────────────────────────────────────────────────

router.post("/2fa/verify-login", async (req, res) => {
  const pending = req.session.pending2fa;
  if (!pending) {
    res.status(400).json({ error: "Bad request", message: "Tidak ada sesi 2FA yang menunggu." });
    return;
  }

  const { token } = req.body ?? {};
  if (!token) {
    res.status(400).json({ error: "Bad request", message: "Kode 2FA wajib diisi." });
    return;
  }

  const tfa = await db
    .select()
    .from(userTwoFactorTable)
    .where(eq(userTwoFactorTable.userId, pending.userId))
    .limit(1);

  if (tfa.length === 0 || !tfa[0].enabled) {
    res.status(400).json({ error: "Bad request", message: "2FA tidak aktif." });
    return;
  }

  const isValid = speakeasy.totp.verify({
    secret: tfa[0].secret,
    encoding: "base32",
    token: String(token),
    window: 1,
  });

  if (!isValid) {
    let backupCodes: string[] = [];
    try {
      backupCodes = JSON.parse(tfa[0].backupCodes);
    } catch {
      backupCodes = [];
    }
    const backupIdx = backupCodes.indexOf(String(token));
    if (backupIdx === -1) {
      res.status(401).json({ error: "Unauthorized", message: "Kode 2FA tidak valid." });
      return;
    }
    backupCodes.splice(backupIdx, 1);
    await db
      .update(userTwoFactorTable)
      .set({ backupCodes: JSON.stringify(backupCodes) })
      .where(eq(userTwoFactorTable.userId, pending.userId));
  }

  req.session.userId = pending.userId;
  req.session.userRole = pending.userRole;
  delete req.session.pending2fa;

  const users = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, pending.userId))
    .limit(1);
  const user = users[0];

  res.json({ id: user.id, email: user.email, role: user.role, createdAt: user.createdAt });
});

router.get("/2fa/status", requireAuth, async (req, res) => {
  const userId = req.session.userId!;
  const tfa = await db
    .select({ enabled: userTwoFactorTable.enabled })
    .from(userTwoFactorTable)
    .where(eq(userTwoFactorTable.userId, userId))
    .limit(1);

  res.json({ enabled: tfa.length > 0 && tfa[0].enabled });
});

router.post("/2fa/setup", requireAuth, async (req, res) => {
  const userId = req.session.userId!;
  const users = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, userId))
    .limit(1);
  const user = users[0];

  const existing = await db
    .select()
    .from(userTwoFactorTable)
    .where(eq(userTwoFactorTable.userId, userId))
    .limit(1);

  let secret: string;
  if (existing.length > 0) {
    secret = existing[0].secret;
  } else {
    secret = speakeasy.generateSecret({ length: 20 }).base32;
    await db.insert(userTwoFactorTable).values({ userId, secret });
  }

  const otpauth = speakeasy.otpauthURL({
    secret,
    label: user.email,
    issuer: "TempMail",
    encoding: "base32",
  });
  const qrDataUrl = await QRCode.toDataURL(otpauth);

  res.json({ secret, otpauth, qrDataUrl });
});

router.post("/2fa/enable", requireAuth, async (req, res) => {
  const userId = req.session.userId!;
  const { token } = req.body ?? {};

  if (!token) {
    res.status(400).json({ error: "Bad request", message: "Kode verifikasi wajib diisi." });
    return;
  }

  const tfa = await db
    .select()
    .from(userTwoFactorTable)
    .where(eq(userTwoFactorTable.userId, userId))
    .limit(1);

  if (tfa.length === 0) {
    res.status(400).json({ error: "Bad request", message: "Jalankan setup 2FA terlebih dahulu." });
    return;
  }

  const isValid = speakeasy.totp.verify({
    secret: tfa[0].secret,
    encoding: "base32",
    token: String(token),
    window: 1,
  });
  if (!isValid) {
    res.status(401).json({ error: "Unauthorized", message: "Kode verifikasi tidak valid." });
    return;
  }

  const backupCodes = Array.from({ length: 8 }, () =>
    randomBytes(4).toString("hex").toUpperCase()
  );

  await db
    .update(userTwoFactorTable)
    .set({ enabled: true, backupCodes: JSON.stringify(backupCodes) })
    .where(eq(userTwoFactorTable.userId, userId));

  res.json({ success: true, backupCodes });
});

router.post("/2fa/disable", requireAuth, async (req, res) => {
  const userId = req.session.userId!;
  const { token } = req.body ?? {};

  if (!token) {
    res.status(400).json({ error: "Bad request", message: "Kode verifikasi wajib diisi." });
    return;
  }

  const tfa = await db
    .select()
    .from(userTwoFactorTable)
    .where(eq(userTwoFactorTable.userId, userId))
    .limit(1);

  if (tfa.length === 0 || !tfa[0].enabled) {
    res.status(400).json({ error: "Bad request", message: "2FA tidak aktif." });
    return;
  }

  const isValidDisable = speakeasy.totp.verify({
    secret: tfa[0].secret,
    encoding: "base32",
    token: String(token),
    window: 1,
  });
  if (!isValidDisable) {
    res.status(401).json({ error: "Unauthorized", message: "Kode verifikasi tidak valid." });
    return;
  }

  await db
    .update(userTwoFactorTable)
    .set({ enabled: false })
    .where(eq(userTwoFactorTable.userId, userId));

  res.json({ success: true });
});

router.post("/change-password", requireAuth, async (req, res) => {
  const userId = req.session.userId!;
  const { currentPassword, newPassword } = req.body ?? {};

  if (!currentPassword || !newPassword) {
    res.status(400).json({ error: "Bad request", message: "Password lama dan baru wajib diisi." });
    return;
  }

  if (typeof newPassword !== "string" || newPassword.length < 6) {
    res.status(400).json({ error: "Bad request", message: "Password baru minimal 6 karakter." });
    return;
  }

  const users = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, userId))
    .limit(1);
  const user = users[0];

  const valid = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!valid) {
    res.status(401).json({ error: "Unauthorized", message: "Password lama tidak cocok." });
    return;
  }

  const passwordHash = await bcrypt.hash(newPassword, 10);
  await db.update(usersTable).set({ passwordHash }).where(eq(usersTable.id, userId));

  res.json({ success: true, message: "Password berhasil diubah." });
});

export { router as authRouter };
