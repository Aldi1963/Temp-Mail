// Utilitas OTP bersama untuk web: deteksi kode, hitung mundur kedaluwarsa,
// dan penanda "terpakai" (localStorage).

export interface OtpInfo {
  code: string;
  messageId: string;
  from: string;
  subject: string;
  receivedAt: string;
}

// Estimasi masa berlaku OTP bila pengirim tidak menyebutkannya eksplisit.
export const OTP_VALIDITY_MS = 10 * 60 * 1000;

const KEYWORDS = "code|kode|otp|pin|verifikasi|verification|verify|token|passcode|kata sandi";

// Pola digit (case-insensitive) — prioritas utama
const OTP_DIGIT_PATTERNS: RegExp[] = [
  // kata kunci + angka, mis. "Kode OTP: 482916", "Your code is 123456"
  new RegExp(`\\b(?:${KEYWORDS})\\b[^\\dA-Za-z]{1,30}(\\d{4,8})\\b`, "i"),
  // pola 3-3 dengan spasi/strip, mis. "123 456", "123-456"
  /\b([0-9]{3}[-\s][0-9]{3})\b/,
  // prefix layanan, mis. "G-123456", "FB-12345"
  /\b(?:G-|FB-)(\d{5,6})\b/i,
  // 6 digit polos
  /\b(\d{6})\b/,
  // 4-8 digit polos (fallback terakhir)
  /\b(\d{4,8})\b/,
];

// Pola kode alfanumerik setelah kata kunci, mis. "Kode: XK7-29P".
// Hasilnya divalidasi: harus mengandung digit & tanpa huruf kecil
// (mencegah false positive seperti "OTP Anda" / "code is 123").
const OTP_ALNUM_PATTERN = new RegExp(
  `\\b(?:${KEYWORDS})\\b[^\\dA-Za-z]{1,30}([A-Z0-9][A-Z0-9 \\-]{2,10}[A-Z0-9])\\b`,
  "i"
);

/** Deteksi kode OTP dari teks bebas. Mengembalikan kode mentah atau null. */
export function extractOtp(text: string): string | null {
  if (!text) return null;
  for (const pattern of OTP_DIGIT_PATTERNS) {
    const match = text.match(pattern);
    if (match) return (match[1] || match[0]).trim();
  }
  const alnum = text.match(OTP_ALNUM_PATTERN);
  if (alnum) {
    const code = alnum[1].trim();
    if (/\d/.test(code) && !/[a-z]/.test(code)) return code;
  }
  return null;
}

/** Normalisasi kode untuk disalin: buang spasi/strip, mis. "123 456" -> "123456". */
export function normalizeOtp(code: string): string {
  return code.replace(/[-\s]/g, "");
}

/** Pindai subjek + preview sebuah ringkasan pesan untuk OTP. */
export function extractOtpFromSummary(subject: string, preview: string): string | null {
  return extractOtp(`${subject || ""} ${preview || ""}`);
}

/** Pindai seluruh inbox, kembalikan daftar OTP unik (1 per pesan, pesan terbaru dulu). */
export function scanInboxOtps(
  messages: Array<{ id: string; from: string; subject: string; preview: string; receivedAt: string }>
): OtpInfo[] {
  const out: OtpInfo[] = [];
  for (const m of messages) {
    const code = extractOtpFromSummary(m.subject, m.preview);
    if (code) {
      out.push({ code, messageId: m.id, from: m.from, subject: m.subject, receivedAt: m.receivedAt });
    }
  }
  return out;
}

/** Sisa waktu (ms) sebelum OTP dianggap kedaluwarsa. Bisa negatif bila sudah lewat. */
export function getOtpRemainingMs(receivedAt: string): number {
  const t = Date.parse(receivedAt);
  if (Number.isNaN(t)) return 0;
  return t + OTP_VALIDITY_MS - Date.now();
}

/** Format sisa waktu jadi "M:SS", atau "kedaluwarsa" bila <= 0. */
export function formatOtpCountdown(remainingMs: number): string {
  if (remainingMs <= 0) return "kedaluwarsa";
  const totalSec = Math.ceil(remainingMs / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

// ── Penanda "terpakai" (localStorage) ────────────────────────────────────────

const USED_KEY = "tempmail_otp_used";
const MAX_USED = 200;

function readUsed(): string[] {
  try {
    const raw = localStorage.getItem(USED_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}

function usedEntryKey(messageId: string, code: string): string {
  return `${messageId}:${code}`;
}

export function isOtpUsed(messageId: string, code: string): boolean {
  return readUsed().includes(usedEntryKey(messageId, code));
}

export function setOtpUsed(messageId: string, code: string, used: boolean): void {
  try {
    let arr = readUsed();
    const key = usedEntryKey(messageId, code);
    if (used) {
      if (!arr.includes(key)) arr.unshift(key);
      arr = arr.slice(0, MAX_USED);
    } else {
      arr = arr.filter((k) => k !== key);
    }
    localStorage.setItem(USED_KEY, JSON.stringify(arr));
  } catch {
    /* abaikan */
  }
}
