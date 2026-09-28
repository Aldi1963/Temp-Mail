// Base URL untuk semua panggilan API.
// - Web: relatif mengikuti BASE_URL (mis. "/tempmail").
// - Aplikasi native (Capacitor): absolut via VITE_API_BASE_URL
//   (mis. "https://m.clipku.com/tempmail").
const WEB_BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

export const API_BASE_URL: string =
  import.meta.env.VITE_API_BASE_URL || WEB_BASE;

// Base absolut lengkap (termasuk origin) untuk URL yang ditampilkan,
// disalin, atau dipakai di contoh kode (Postman, link verifikasi).
export function getFullBase(): string {
  if (import.meta.env.VITE_API_BASE_URL) return import.meta.env.VITE_API_BASE_URL;
  return typeof window !== "undefined" ? window.location.origin + WEB_BASE : WEB_BASE;
}

// Base path untuk router (wouter).
// - Web: "/tempmail" (mengikuti BASE_URL).
// - Aplikasi native: "" karena disajikan dari root (https://localhost/).
export const ROUTER_BASE: string = import.meta.env.VITE_API_BASE_URL
  ? ""
  : import.meta.env.BASE_URL.replace(/\/$/, "");
