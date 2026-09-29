import { Router } from "express";
import { randomBytes, createHmac } from "crypto";
import { db } from "@workspace/db";
import { usersTable, userTwoFactorTable, activityLogsTable, emailVerificationTokensTable, nativeTokensTable } from "@workspace/db";
import { eq, count, and, gt, isNull } from "drizzle-orm";
import bcrypt from "bcryptjs";
import speakeasy from "speakeasy";
import QRCode from "qrcode";
import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import { requireAuth, hashNativeToken, extractNativeToken } from "../lib/auth.js";
import { encryptTotpSecret, decryptTotpSecret, isEncryptedTotpSecret } from "../lib/totp-crypto.js";

declare module "express-session" {
  interface SessionData {
    pending2fa?: { userId: number; userRole: string };
  }
}

const router = Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: "Too Many Requests",
    message: "Terlalu banyak percobaan login. Coba lagi dalam 15 menit.",
  },
  skipSuccessfulRequests: true,
});

const verify2faLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  // Batasi per IP + akun (sesi pending2fa) agar satu IP tidak bisa brute-force banyak akun
  keyGenerator: (req) => `${ipKeyGenerator(req.ip ?? "")}:${(req.session as any)?.pending2fa?.userId ?? "anon"}`,
  message: {
    error: "Too Many Requests",
    message: "Terlalu banyak percobaan kode 2FA. Coba lagi dalam 15 menit.",
  },
});

const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: "Too Many Requests",
    message: "Terlalu banyak percobaan pendaftaran. Coba lagi dalam 1 jam.",
  },
});

const nativeTokenLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: "Too Many Requests",
    message: "Terlalu banyak percobaan. Coba lagi dalam 15 menit.",
  },
  skipSuccessfulRequests: true,
});

async function logActivity(
  userId: number,
  action: string,
  description: string,
  metadata: Record<string, unknown> = {}
) {
  try {
    await db.insert(activityLogsTable).values({
      userId,
      action,
      description,
      metadata: JSON.stringify(metadata),
    });
  } catch {
    /* non-fatal */
  }
}

router.post("/register", registerLimiter, async (req, res) => {
  const { email, password } = req.body ?? {};

  if (!email || !password) {
    res.status(400).json({ error: "Bad request", message: "Email dan password wajib diisi." });
    return;
  }

  if (typeof password !== "string" || password.length < 8) {
    res.status(400).json({ error: "Bad request", message: "Password minimal 8 karakter." });
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

  await logActivity(user.id, "register", "Akun baru berhasil dibuat");

  res.json({ id: user.id, email: user.email, role: user.role, createdAt: user.createdAt });
});

router.post("/login", loginLimiter, async (req, res) => {
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
  if (!user.passwordHash) {
    res.status(401).json({ error: "Unauthorized", message: "Akun ini memakai login Google. Masuk dengan tombol Google." });
    return;
  }
  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    res.status(401).json({ error: "Unauthorized", message: "Email atau password salah." });
    return;
  }

  if (user.suspended) {
    res.status(403).json({ error: "Forbidden", message: "Akun dinonaktifkan. Hubungi administrator." });
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

  await logActivity(user.id, "login", "Login berhasil");

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
  res.json({
    id: user.id,
    email: user.email,
    role: user.role,
    emailVerified: user.emailVerified,
    telegramChatId: user.telegramChatId,
    createdAt: user.createdAt,
  });
});

// ─── NATIVE TOKEN (login persisten aplikasi Android) ─────────────────────────
// Cookie sesi tidak bertahan di WebView (origin https://localhost), jadi
// aplikasi memakai token bearer tm_* berumur 365 hari sebagai pengganti sesi.

router.post("/native-token", nativeTokenLimiter, async (req, res) => {
  const { email, password, name } = req.body ?? {};

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
  if (!user.passwordHash) {
    res.status(401).json({ error: "Unauthorized", message: "Akun ini memakai login Google. Masuk dengan tombol Google." });
    return;
  }
  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    res.status(401).json({ error: "Unauthorized", message: "Email atau password salah." });
    return;
  }

  if (user.suspended) {
    res.status(403).json({ error: "Forbidden", message: "Akun dinonaktifkan. Hubungi administrator." });
    return;
  }

  // Token berumur 1 tahun tidak boleh melewati 2FA: wajib dimatikan dulu di web.
  const tfa = await db
    .select()
    .from(userTwoFactorTable)
    .where(eq(userTwoFactorTable.userId, user.id))
    .limit(1);
  if (tfa.length > 0 && tfa[0].enabled) {
    res.status(403).json({
      error: "Forbidden",
      message: "Akun memakai 2FA. Nonaktifkan 2FA di web sebelum membuat token aplikasi.",
    });
    return;
  }

  const rawToken = `tm_${randomBytes(32).toString("hex")}`;
  const expiresAt = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
  await db.insert(nativeTokensTable).values({
    userId: user.id,
    tokenHash: hashNativeToken(rawToken),
    name: typeof name === "string" && name.trim() ? name.trim().slice(0, 64) : "android",
    expiresAt,
  });

  await logActivity(user.id, "native_token_created", "Token aplikasi Android dibuat");

  res.json({
    token: rawToken,
    user: { id: user.id, email: user.email, role: user.role, emailVerified: user.emailVerified },
  });
});

router.delete("/native-token", async (req, res) => {
  const token = extractNativeToken(req);
  if (!token) {
    res.status(404).json({ error: "Not Found", message: "Token tidak ditemukan." });
    return;
  }
  const deleted = await db
    .delete(nativeTokensTable)
    .where(eq(nativeTokensTable.tokenHash, hashNativeToken(token)))
    .returning({ id: nativeTokensTable.id });
  if (deleted.length === 0) {
    res.status(404).json({ error: "Not Found", message: "Token tidak ditemukan." });
    return;
  }
  res.json({ revoked: true });
});

// ─── EMAIL VERIFICATION ───────────────────────────────────────────────────────

router.post("/send-verification", requireAuth, async (_req, res) => {
  // Verifikasi email DINONAKTIFKAN: tidak ada layanan SMTP yang terkonfigurasi,
  // dan implementasi sebelumnya hanya mengembalikan URL verifikasi tanpa
  // benar-benar mengirim email (verifikasi semu). Jangan aktifkan kembali
  // sebelum ada pengiriman email sungguhan.
  res.status(410).json({
    error: "Gone",
    message: "Verifikasi email dinonaktifkan: server belum terhubung ke layanan pengiriman email.",
  });
});

router.post("/verify-email", async (req, res) => {
  const { token } = req.body ?? {};
  if (!token) {
    res.status(400).json({ error: "Bad request", message: "Token tidak valid." });
    return;
  }

  const tokens = await db
    .select()
    .from(emailVerificationTokensTable)
    .where(
      and(
        eq(emailVerificationTokensTable.token, token),
        gt(emailVerificationTokensTable.expiresAt, new Date()),
        isNull(emailVerificationTokensTable.usedAt)
      )
    )
    .limit(1);

  if (tokens.length === 0) {
    res.status(400).json({ error: "Bad request", message: "Token tidak valid atau sudah kadaluarsa." });
    return;
  }

  const vt = tokens[0];

  await db
    .update(usersTable)
    .set({ emailVerified: true })
    .where(eq(usersTable.id, vt.userId));

  await db
    .update(emailVerificationTokensTable)
    .set({ usedAt: new Date() })
    .where(eq(emailVerificationTokensTable.id, vt.id));

  await logActivity(vt.userId, "email_verified", "Email akun berhasil diverifikasi");

  res.json({ success: true, message: "Email berhasil diverifikasi!" });
});

// ─── 2FA ─────────────────────────────────────────────────────────────────────

router.post("/2fa/verify-login", verify2faLimiter, async (req, res) => {
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
    secret: decryptTotpSecret(tfa[0].secret),
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
      await logActivity(pending.userId, "login_2fa_failed", "Percobaan kode 2FA gagal");
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

  // Migrasi malas: enkripsi secret lama yang masih plaintext
  if (!isEncryptedTotpSecret(tfa[0].secret)) {
    await db.update(userTwoFactorTable).set({ secret: encryptTotpSecret(decryptTotpSecret(tfa[0].secret)) }).where(eq(userTwoFactorTable.userId, pending.userId));
  }

  const users = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, pending.userId))
    .limit(1);
  const user = users[0];

  await logActivity(pending.userId, "login_2fa", "Login berhasil dengan verifikasi 2FA");

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
    secret = decryptTotpSecret(existing[0].secret);
  } else {
    secret = speakeasy.generateSecret({ length: 20 }).base32;
    await db.insert(userTwoFactorTable).values({ userId, secret: encryptTotpSecret(secret) });
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
    secret: decryptTotpSecret(tfa[0].secret),
    encoding: "base32",
    token: String(token),
    window: 1,
  });
  if (!isValid) {
    res.status(401).json({ error: "Unauthorized", message: "Kode verifikasi tidak valid." });
    return;
  }

  // Migrasi malas: enkripsi secret lama yang masih plaintext
  if (!isEncryptedTotpSecret(tfa[0].secret)) {
    await db.update(userTwoFactorTable).set({ secret: encryptTotpSecret(decryptTotpSecret(tfa[0].secret)) }).where(eq(userTwoFactorTable.userId, userId));
  }

  const backupCodes = Array.from({ length: 8 }, () =>
    randomBytes(4).toString("hex").toUpperCase()
  );

  await db
    .update(userTwoFactorTable)
    .set({ enabled: true, backupCodes: JSON.stringify(backupCodes) })
    .where(eq(userTwoFactorTable.userId, userId));

  await logActivity(userId, "2fa_enabled", "Autentikasi dua faktor (2FA) diaktifkan");

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
    secret: decryptTotpSecret(tfa[0].secret),
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

  await logActivity(userId, "2fa_disabled", "Autentikasi dua faktor (2FA) dinonaktifkan");

  res.json({ success: true });
});

router.post("/change-password", requireAuth, async (req, res) => {
  const userId = req.session.userId!;
  const { currentPassword, newPassword } = req.body ?? {};

  if (!currentPassword || !newPassword) {
    res.status(400).json({ error: "Bad request", message: "Password lama dan baru wajib diisi." });
    return;
  }

  if (typeof newPassword !== "string" || newPassword.length < 8) {
    res.status(400).json({ error: "Bad request", message: "Password baru minimal 8 karakter." });
    return;
  }

  const users = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, userId))
    .limit(1);
  const user = users[0];

  if (!user.passwordHash) {
    res.status(400).json({ error: "Bad request", message: "Akun Google belum punya password." });
    return;
  }
  const valid = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!valid) {
    res.status(401).json({ error: "Unauthorized", message: "Password lama tidak cocok." });
    return;
  }

  const passwordHash = await bcrypt.hash(newPassword, 10);
  await db.update(usersTable).set({ passwordHash }).where(eq(usersTable.id, userId));

  await logActivity(userId, "password_changed", "Password akun berhasil diubah");

  res.json({ success: true, message: "Password berhasil diubah." });
});

// ─── GOOGLE OAUTH ─────────────────────────────────────────────────────────
// Alur: GET /api/auth/google?mode=native|web → redirect ke Google →
// callback tukar code → profil → cari/buat user →
//   mode=native: buat native token, redirect ke deep link aplikasi
//   mode=web:    set sesi cookie, redirect ke /tempmail/
const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v3/userinfo";
const NATIVE_OAUTH_DEEPLINK = "com.clipku.tempmail://oauth/google";

function googleConfigured(): boolean {
  return !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

function googleRedirectUri(): string {
  return (
    process.env.GOOGLE_REDIRECT_URI ||
    "https://m.clipku.com/tempmail/api/auth/google/callback"
  );
}

// State anti-CSRF stateless: payload.base64url + HMAC-SHA256(payload, SESSION_SECRET).
function signOAuthState(mode: string): string {
  const secret = process.env.SESSION_SECRET || "tempmail-dev-secret";
  const payload = Buffer.from(
    JSON.stringify({ m: mode, n: randomBytes(16).toString("hex"), t: Date.now() })
  ).toString("base64url");
  const sig = createHmac("sha256", secret).update(payload).digest("base64url");
  return `${payload}.${sig}`;
}

function verifyOAuthState(state: string): { m: string } | null {
  try {
    const secret = process.env.SESSION_SECRET || "tempmail-dev-secret";
    const [payload, sig] = state.split(".");
    if (!payload || !sig) return null;
    const expected = createHmac("sha256", secret).update(payload).digest("base64url");
    if (sig.length !== expected.length) return null;
    let diff = 0;
    for (let i = 0; i < sig.length; i++) diff |= sig.charCodeAt(i) ^ expected.charCodeAt(i);
    if (diff !== 0) return null;
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (typeof data.m !== "string" || typeof data.t !== "number") return null;
    if (Date.now() - data.t > 10 * 60 * 1000) return null; // kedaluwarsa 10 menit
    return { m: data.m };
  } catch {
    return null;
  }
}

const googleLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: "Too Many Requests",
    message: "Terlalu banyak percobaan. Coba lagi dalam 15 menit.",
  },
});

// Status provider login pihak ketiga (dipakai aplikasi untuk show/hide tombol).
router.get("/providers", (_req, res) => {
  res.json({ google: googleConfigured() });
});

router.get("/google", googleLimiter, (req, res) => {
  if (!googleConfigured()) {
    res.status(503).json({
      error: "Service Unavailable",
      message: "Login Google belum dikonfigurasi di server.",
    });
    return;
  }
  const mode = req.query.mode === "native" ? "native" : "web";
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID as string,
    redirect_uri: googleRedirectUri(),
    response_type: "code",
    scope: "openid email profile",
    state: signOAuthState(mode),
    prompt: "select_account",
  });
  res.redirect(302, `${GOOGLE_AUTH_URL}?${params.toString()}`);
});

router.get("/google/callback", googleLimiter, async (req, res) => {
  const fail = (mode: string, message: string) => {
    if (mode === "native") {
      res.redirect(
        302,
        `${NATIVE_OAUTH_DEEPLINK}?error=${encodeURIComponent(message)}`
      );
    } else {
      res
        .status(400)
        .send(
          `<html><body style="font-family:sans-serif;padding:40px"><h3>Login Google gagal</h3><p>${message.replace(/</g, "&lt;")}</p></body></html>`
        );
    }
  };
  try {
    if (!googleConfigured()) {
      fail("web", "Login Google belum dikonfigurasi di server.");
      return;
    }
    const { code, state } = req.query as { code?: string; state?: string };
    const verified = typeof state === "string" ? verifyOAuthState(state) : null;
    if (!code || !verified) {
      fail("web", "Sesi login tidak valid atau kedaluwarsa. Silakan ulangi.");
      return;
    }
    const mode = verified.m;

    // Tukar authorization code dengan access token.
    const tokenRes = await fetch(GOOGLE_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: process.env.GOOGLE_CLIENT_ID as string,
        client_secret: process.env.GOOGLE_CLIENT_SECRET as string,
        redirect_uri: googleRedirectUri(),
        grant_type: "authorization_code",
      }),
    });
    if (!tokenRes.ok) {
      fail(mode, "Gagal menukar kode otorisasi Google.");
      return;
    }
    const tokenData = (await tokenRes.json()) as { access_token?: string };
    if (!tokenData.access_token) {
      fail(mode, "Token Google tidak diterima.");
      return;
    }

    // Ambil profil Google.
    const meRes = await fetch(GOOGLE_USERINFO_URL, {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    if (!meRes.ok) {
      fail(mode, "Gagal membaca profil Google.");
      return;
    }
    const profile = (await meRes.json()) as {
      sub?: string;
      email?: string;
      name?: string;
    };
    if (!profile.sub || !profile.email) {
      fail(mode, "Profil Google tidak lengkap.");
      return;
    }
    const email = profile.email.toLowerCase().trim();

    // Cari user: cocokkan googleId dulu, lalu email (tautkan bila cocok).
    let user = (
      await db.select().from(usersTable).where(eq(usersTable.googleId, profile.sub)).limit(1)
    )[0];
    if (!user) {
      const byEmail = (
        await db.select().from(usersTable).where(eq(usersTable.email, email)).limit(1)
      )[0];
      if (byEmail) {
        if (!byEmail.googleId) {
          await db
            .update(usersTable)
            .set({ googleId: profile.sub, emailVerified: true })
            .where(eq(usersTable.id, byEmail.id));
          user = { ...byEmail, googleId: profile.sub, emailVerified: true };
          await logActivity(user.id, "link_google", "Akun Google ditautkan");
        } else if (byEmail.googleId !== profile.sub) {
          fail(mode, "Email ini sudah terhubung ke akun Google lain.");
          return;
        } else {
          user = byEmail;
        }
      }
    }
    if (!user) {
      const inserted = await db
        .insert(usersTable)
        .values({
          email,
          passwordHash: null,
          googleId: profile.sub,
          emailVerified: true,
          role: "user",
        })
        .returning();
      user = inserted[0];
      await logActivity(user.id, "register_google", "Akun dibuat via login Google");
    }

    if (user.suspended) {
      fail(mode, "Akun dinonaktifkan. Hubungi administrator.");
      return;
    }

    // 2FA belum didukung di alur Google: tolak dengan pesan jelas.
    const tfa = await db
      .select()
      .from(userTwoFactorTable)
      .where(eq(userTwoFactorTable.userId, user.id))
      .limit(1);
    if (tfa.length > 0 && tfa[0].enabled) {
      fail(mode, "Akun memakai 2FA. Nonaktifkan 2FA di web sebelum memakai login Google.");
      return;
    }

    await logActivity(user.id, "login_google", "Login via Google berhasil");

    if (mode === "native") {
      const rawToken = `tm_${randomBytes(32).toString("hex")}`;
      const expiresAt = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
      await db.insert(nativeTokensTable).values({
        userId: user.id,
        tokenHash: hashNativeToken(rawToken),
        name: "android-google",
        expiresAt,
      });
      await logActivity(user.id, "native_token_created", "Token aplikasi Android dibuat via Google");
      const params = new URLSearchParams({
        token: rawToken,
        email: user.email,
        uid: String(user.id),
      });
      res.redirect(302, `${NATIVE_OAUTH_DEEPLINK}?${params.toString()}`);
      return;
    }

    req.session.userId = user.id;
    req.session.userRole = user.role;
    res.redirect(302, "/tempmail/");
  } catch (err) {
    console.error("Google OAuth callback error:", err);
    fail("web", "Terjadi kesalahan saat login Google.");
  }
});

export { router as authRouter };
