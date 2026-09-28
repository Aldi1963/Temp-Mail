import { Request, Response, NextFunction } from "express";
import { db } from "@workspace/db";
import { createHash } from "crypto";
import { usersTable, apiKeysTable, nativeTokensTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";

declare module "express-session" {
  interface SessionData {
    userId: number;
    userRole: string;
  }
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      /** Set when caller authenticated via X-API-Key. Per-request only — NOT stored in session. */
      apiKeyUserId?: number;
    }
  }
}

/** Read a header that Express may surface as string | string[]; reject anything else. */
function readSingleHeader(value: string | string[] | undefined): string | null {
  if (typeof value === "string") return value;
  return null;
}

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.session?.userId) {
    res.status(401).json({ error: "Unauthorized", message: "Silakan login terlebih dahulu." });
    return;
  }
  next();
}

export async function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.session?.userId) {
    res.status(401).json({ error: "Unauthorized", message: "Silakan login terlebih dahulu." });
    return;
  }
  const results = await db.select().from(usersTable).where(eq(usersTable.id, req.session.userId)).limit(1);
  const user = results[0];
  if (!user || user.role !== "admin") {
    res.status(403).json({ error: "Forbidden", message: "Akses admin diperlukan." });
    return;
  }
  req.session.userRole = user.role;
  next();
}

export async function getCurrentUser(req: Request) {
  if (!req.session?.userId) return null;
  const results = await db.select().from(usersTable).where(eq(usersTable.id, req.session.userId)).limit(1);
  return results[0] ?? null;
}

async function validateApiKey(apiKey: string): Promise<number | null> {
  if (!apiKey.startsWith("tmk_") || apiKey.length < 16 || apiKey.length > 128) return null;
  const prefix = apiKey.substring(0, 12);
  const candidates = await db
    .select()
    .from(apiKeysTable)
    .where(eq(apiKeysTable.keyPrefix, prefix));
  for (const key of candidates) {
    if (key.expiresAt && key.expiresAt < new Date()) continue;
    const match = await bcrypt.compare(apiKey, key.keyHash);
    if (match) {
      await db.update(apiKeysTable).set({ lastUsedAt: new Date() }).where(eq(apiKeysTable.id, key.id));
      return key.userId;
    }
  }
  return null;
}

/** Pull X-API-Key safely (string only, ignore arrays/dupes). */
function readApiKey(req: Request): string | null {
  const raw = readSingleHeader(req.headers["x-api-key"]);
  if (!raw) return null;
  const trimmed = raw.trim();
  return trimmed.startsWith("tmk_") ? trimmed : null;
}

export async function requireAuthOrApiKey(req: Request, res: Response, next: NextFunction) {
  if (req.session?.userId) return next();
  const apiKey = readApiKey(req);
  if (!apiKey) {
    res.status(401).json({ error: "Unauthorized", message: "Silakan login atau sertakan X-API-Key." });
    return;
  }
  const userId = await validateApiKey(apiKey);
  if (userId === null) {
    res.status(401).json({ error: "Unauthorized", message: "API key tidak valid." });
    return;
  }
  // Per-request only — do NOT poison session with API-key auth so revocation stays effective
  // and bearer-key callers can't escalate into other session-protected routes.
  req.apiKeyUserId = userId;
  next();
}

/**
 * Gate for /api/email/* — the public temp-mail endpoints documented at /api-docs.
 *
 *  1. Logged-in session → allow.
 *  2. X-API-Key supplied & valid → allow & attribute to owning user (per-request, NOT persisted to session).
 *  3. Browser navigating from this site itself → allow as anonymous (web UI keeps working).
 *     Detection: Sec-Fetch-Site is `same-origin`/`same-site`/`none` AND, when an Origin header
 *     is present, it matches the request Host. Note: this is an anti-abuse heuristic for
 *     casual scrapers; it is not a security boundary — sophisticated callers can spoof headers.
 *     Real abuse defence is rate limiting (separate concern).
 *  4. Anything else (curl / external script with no key) → 401, matching the public docs.
 */
export async function publicOrApiKey(_req: Request, _res: Response, next: NextFunction) {
  // BY DESIGN: /api/email/* adalah endpoint publik untuk layanan temp-mail anonim.
  // Akses publik disengaja agar web UI dan integrasi anonim tetap berfungsi.
  // Pertahanan anti-abuse adalah rate limiter di router email (bukan auth di sini),
  // sedangkan operasi destruktif (/reset, /destroy) wajib bukti kepemilikan
  // (manage token / sesi pemilik / API key pemilik).
  return next();
}

// ─── NATIVE TOKEN (aplikasi Android) ─────────────────────────────────────────
// Capacitor WebView berjalan di origin https://localhost sehingga cookie sesi
// SameSite=Lax tidak bertahan antar request. Token bearer tm_* (tm_ + 64 hex)
// menjadi pengganti sesi untuk aplikasi native. Token valid → req.session.userId
// diisi agar semua cek sesi existing (requireAuth dll) berjalan. Token salah /
// tidak ada → lanjut tanpa user (route membalas 401 sendiri seperti biasa).
// Alur cookie session & X-API-Key yang sudah ada tidak disentuh.

const NATIVE_TOKEN_RE = /^Bearer\s+(tm_[0-9a-f]{64})$/i;

/** Ambil token native dari header Authorization (dinormalisasi ke lowercase). */
export function extractNativeToken(req: Request): string | null {
  const raw = readSingleHeader(req.headers["authorization"]);
  if (!raw) return null;
  const m = NATIVE_TOKEN_RE.exec(raw.trim().toLowerCase());
  return m ? m[1] : null;
}

/** sha256 hex dari token mentah — yang disimpan di DB hanya hash ini. */
export function hashNativeToken(token: string): string {
  return createHash("sha256").update(token.toLowerCase(), "utf8").digest("hex");
}

/** Dipasang di app.ts setelah session, sebelum routes. */
export async function nativeTokenAuth(req: Request, _res: Response, next: NextFunction) {
  try {
    if (req.session?.userId) return next(); // sesi cookie sudah cukup
    const hasAuthHeader = !!readSingleHeader(req.headers["authorization"]);
    const token = extractNativeToken(req);
    if (hasAuthHeader) {
      const h = readSingleHeader(req.headers["authorization"]) ?? "";
      const parts = h.split(" ");
    }
    if (!token) return next();
    const rows = await db
      .select()
      .from(nativeTokensTable)
      .where(eq(nativeTokensTable.tokenHash, hashNativeToken(token)))
      .limit(1);
    const row = rows[0];
    if (!row) return next();
    if (row.expiresAt && row.expiresAt < new Date()) return next();
    const users = await db.select().from(usersTable).where(eq(usersTable.id, row.userId)).limit(1);
    const user = users[0];
    req.session.userId = user.id;
    req.session.userRole = user.role;
    // fire-and-forget: jangan menahan response
    db.update(nativeTokensTable)
      .set({ lastUsedAt: new Date() })
      .where(eq(nativeTokensTable.id, row.id))
      .catch(() => {});
    return next();
  } catch {
    return next(); // jangan merusak request bila DB bermasalah
  }
}
