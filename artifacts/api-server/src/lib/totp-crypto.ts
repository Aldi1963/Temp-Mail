import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

const PREFIX = "v1";

// Cache untuk fallback dev agar enkripsi & dekripsi dalam satu proses konsisten
let devFallbackKey: Buffer | null = null;

/** Parse TOTP_ENCRYPTION_KEY (base64 32 byte atau hex 64 char). */
function getKey(): Buffer {
  const raw = (process.env.TOTP_ENCRYPTION_KEY || "").trim();
  if (!raw) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("TOTP_ENCRYPTION_KEY wajib di-set di production (.env)");
    }
    // Dev-only fallback: kunci acak per-proses (tidak persisten antar restart)
    if (!devFallbackKey) devFallbackKey = randomBytes(32);
    return devFallbackKey;
  }
  let key: Buffer;
  if (/^[0-9a-fA-F]{64}$/.test(raw)) key = Buffer.from(raw, "hex");
  else key = Buffer.from(raw, "base64");
  if (key.length !== 32) {
    throw new Error("TOTP_ENCRYPTION_KEY harus 32 byte (base64 atau hex)");
  }
  return key;
}

/** Enkripsi secret TOTP -> format "v1:<iv_b64>:<ct_b64>:<tag_b64>". */
export function encryptTotpSecret(plain: string): string {
  const key = getKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ct = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [PREFIX, iv.toString("base64"), ct.toString("base64"), tag.toString("base64")].join(":");
}

/** True bila format terenkripsi "v1:...". */
export function isEncryptedTotpSecret(stored: string): boolean {
  return typeof stored === "string" && stored.startsWith(PREFIX + ":") && stored.split(":").length === 4;
}

/**
 * Dekripsi secret. Secret lama (plaintext base32, tanpa prefix) tetap didukung
 * untuk migrasi malas (lazy migration): panggil lalu simpan ulang terenkripsi.
 */
export function decryptTotpSecret(stored: string): string {
  if (!isEncryptedTotpSecret(stored)) return stored; // legacy plaintext
  const [, ivB64, ctB64, tagB64] = stored.split(":");
  const key = getKey();
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(ivB64, "base64"));
  decipher.setAuthTag(Buffer.from(tagB64, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(ctB64, "base64")), decipher.final()]).toString("utf8");
}
