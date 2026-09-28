// Helper UI khusus aplikasi native: OTP, avatar pengirim, waktu relatif.

export function extractQuickOtp(text: string): string | null {
  const match =
    text.match(/\b(?:code|kode|otp|pin|verifikasi|token|verification)[^\d]{1,20}(\d{4,8})\b/i) ||
    text.match(/\b([0-9]{3}[-\s][0-9]{3})\b/) ||
    text.match(/\b(?:G-|FB-)(\d{5,6})\b/i) ||
    text.match(/\b(\d{6})\b/);
  return match ? match[1] || match[0] : null;
}

const AVATAR_COLORS = [
  "#7c3aed", "#0891b2", "#059669", "#ea580c",
  "#db2777", "#4f46e5", "#0d9488", "#b45309",
];

export interface SenderMeta {
  name: string;
  letter: string;
  color: string;
}

export function senderMeta(from: string): SenderMeta {
  const raw = (from || "").trim();
  const m = raw.match(/^(?:"?([^"<]*)"?\s*)?<([^>]+)>$/);
  const name = (m ? m[1].trim() || m[2].trim() : raw).replace(/^"|"$/g, "") || raw || "?";
  const letter = (name[0] || "?").toUpperCase();
  let h = 0;
  for (let i = 0; i < raw.length; i++) h = (h * 31 + raw.charCodeAt(i)) >>> 0;
  return { name, letter, color: AVATAR_COLORS[h % AVATAR_COLORS.length] };
}

export function timeAgo(iso: string | null | undefined): string {
  if (!iso) return "";
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return "";
  const s = Math.max(0, (Date.now() - t) / 1000);
  if (s < 60) return "baru saja";
  const min = Math.floor(s / 60);
  if (min < 60) return `${min} mnt`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} jam`;
  const d = Math.floor(hr / 24);
  if (d < 7) return `${d} hri`;
  return new Date(t).toLocaleDateString("id-ID", { day: "numeric", month: "short" });
}

// Sisa waktu menuju kedaluwarsa, format ringkas: "29 hari" / "3 jam" / "45 mnt".
// Mengembalikan "kedaluwarsa" bila waktu sudah lewat, "" bila input tidak valid.
export function timeUntil(iso: string | null | undefined): string {
  if (!iso) return "";
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return "";
  const s = (t - Date.now()) / 1000;
  if (s <= 0) return "kedaluwarsa";
  const min = Math.floor(s / 60);
  if (min < 1) return "<1 mnt";
  if (min < 60) return `${min} mnt`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} jam`;
  return `${Math.floor(hr / 24)} hari`;
}

export function buzz(pattern: number | number[] = 15): void {
  try {
    if (typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate(pattern);
  } catch {
    /* abaikan */
  }
}

export function cleanSnippet(raw: string | null | undefined, max = 90): string {
  return (raw || "").replace(/\s+/g, " ").trim().slice(0, max);
}
