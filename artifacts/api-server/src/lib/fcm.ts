import { createSign } from "crypto";
import { existsSync, readFileSync } from "fs";
import { db } from "@workspace/db";
import { pushTokensTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "./logger";

/**
 * Infrastruktur push notification via Firebase Cloud Messaging (FCM HTTP v1).
 *
 * Service account dibaca dari env FIREBASE_SERVICE_ACCOUNT_JSON (berisi PATH
 * ke file JSON service account). TIDAK ADA kredensial yang di-hardcode.
 *
 * Prinsip desain: push adalah best-effort. Kalau env/file tidak ada atau
 * pengiriman gagal, semuanya dilewati diam-diam (log warning saja) dan
 * TIDAK PERNAH membuat request utama gagal.
 */

interface ServiceAccount {
  client_email: string;
  private_key: string;
  project_id: string;
}

export interface FcmMessage {
  title: string;
  body: string;
  data?: Record<string, string>;
}

function readServiceAccount(): ServiceAccount | null {
  const path = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!path) return null; // Firebase belum dikonfigurasi — lewati diam-diam
  try {
    if (!existsSync(path)) {
      logger.warn("FIREBASE_SERVICE_ACCOUNT_JSON menunjuk ke file yang tidak ada — push FCM dilewati");
      return null;
    }
    const sa = JSON.parse(readFileSync(path, "utf8")) as Partial<ServiceAccount>;
    if (!sa.client_email || !sa.private_key || !sa.project_id) {
      logger.warn("Service account FCM tidak lengkap (butuh client_email, private_key, project_id) — push FCM dilewati");
      return null;
    }
    return sa as ServiceAccount;
  } catch (err) {
    logger.warn({ err }, "Gagal membaca service account FCM — push FCM dilewati");
    return null;
  }
}

// Cache OAuth2 access token di memori (kedaluwarsa ~1 jam)
let tokenCache: { token: string; expiresAtSec: number } | null = null;

async function getAccessToken(sa: ServiceAccount): Promise<string | null> {
  const nowSec = Math.floor(Date.now() / 1000);
  if (tokenCache && tokenCache.expiresAtSec > nowSec + 60) return tokenCache.token;
  try {
    const header = Buffer.from(JSON.stringify({ alg: "RS256", typ: "JWT" })).toString("base64url");
    const claims = {
      iss: sa.client_email,
      sub: sa.client_email,
      aud: "https://oauth2.googleapis.com/token",
      iat: nowSec,
      exp: nowSec + 3600,
      scope: "https://www.googleapis.com/auth/firebase.messaging",
    };
    const payload = Buffer.from(JSON.stringify(claims)).toString("base64url");
    const signature = createSign("RSA-SHA256")
      .update(`${header}.${payload}`)
      .sign(sa.private_key, "base64url");
    const assertion = `${header}.${payload}.${signature}`;

    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
        assertion,
      }),
    });
    if (!res.ok) {
      logger.warn({ status: res.status }, "Gagal mendapatkan access token FCM — push dilewati");
      return null;
    }
    const data = (await res.json()) as { access_token?: string; expires_in?: number };
    if (!data.access_token) return null;
    tokenCache = { token: data.access_token, expiresAtSec: nowSec + (data.expires_in ?? 3600) };
    return tokenCache.token;
  } catch (err) {
    logger.warn({ err }, "Gagal mendapatkan access token FCM — push dilewati");
    return null;
  }
}

/** Kirim satu notifikasi FCM. Tidak pernah throw. */
export async function sendFcmToToken(token: string, msg: FcmMessage): Promise<void> {
  try {
    const sa = readServiceAccount();
    if (!sa) return;
    const accessToken = await getAccessToken(sa);
    if (!accessToken) return;

    const res = await fetch(
      `https://fcm.googleapis.com/v1/projects/${encodeURIComponent(sa.project_id)}/messages:send`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: {
            token,
            notification: { title: msg.title, body: msg.body },
            data: msg.data ?? {},
          },
        }),
      },
    );
    if (!res.ok) {
      // 404 = token tidak valid / aplikasi di-uninstall → bersihkan dari DB
      if (res.status === 404) {
        try {
          await db.delete(pushTokensTable).where(eq(pushTokensTable.token, token));
        } catch {
          /* non-fatal */
        }
      }
      logger.warn({ status: res.status }, "Pengiriman FCM gagal — dilewati");
    }
  } catch (err) {
    logger.warn({ err }, "Pengiriman FCM gagal — dilewati");
  }
}

export interface NewMailPushOpts {
  from: string;
  subject: string;
  messageId: string;
}

/**
 * Kirim push "email baru" ke semua token yang terdaftar untuk alamat email
 * tersebut. Fire-and-forget: panggil TANPA await dari request handler.
 * Tidak pernah throw; semua kegagalan hanya jadi log warning.
 */
export function notifyNewMessagePush(email: string, opts: NewMailPushOpts): void {
  (async () => {
    try {
      const rows = await db
        .select({ token: pushTokensTable.token })
        .from(pushTokensTable)
        .where(eq(pushTokensTable.email, email));
      if (rows.length === 0) return;
      const msg: FcmMessage = {
        title: `Email baru dari ${String(opts.from).slice(0, 100)}`,
        body: String(opts.subject || "(tanpa subjek)").slice(0, 200),
        data: { messageId: opts.messageId, email },
      };
      await Promise.allSettled(rows.map((r) => sendFcmToToken(r.token, msg)));
    } catch (err) {
      logger.warn({ err }, "notifyNewMessagePush gagal — dilewati");
    }
  })();
}
