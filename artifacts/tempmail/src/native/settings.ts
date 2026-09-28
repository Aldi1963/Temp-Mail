// Pengaturan lokal aplikasi native (per-perangkat, localStorage).
// Kontrak bersama: dibaca oleh fitur inbox/OTP, alamat, dan keamanan.
import { useState, useCallback, useEffect } from "react";

export interface NativeSettings {
  autoCopyOtp: boolean; // salin OTP otomatis saat pesan baru masuk
  autoDestroyOtp: boolean; // hapus pesan OTP otomatis setelah dibaca
  pinEnabled: boolean; // kunci aplikasi dengan PIN
  pinHash: string | null; // SHA-256 hex dari PIN ("tm-pin:"+pin)
  notifyOff: string[]; // email yang notifikasinya dimatikan
  favorites: string[]; // email favorit (tampil paling atas)
  labels: Record<string, string>; // label lokal per email
}

const KEY = "tm_native_settings";

export const DEFAULT_SETTINGS: NativeSettings = {
  autoCopyOtp: true,
  autoDestroyOtp: false,
  pinEnabled: false,
  pinHash: null,
  notifyOff: [],
  favorites: [],
  labels: {},
};

export function loadSettings(): NativeSettings {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(s: NativeSettings): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
    window.dispatchEvent(new CustomEvent("tm-settings-changed"));
  } catch {
    /* abaikan */
  }
}

export function updateSettings(patch: Partial<NativeSettings>): NativeSettings {
  const next = { ...loadSettings(), ...patch };
  saveSettings(next);
  return next;
}

export async function hashPin(pin: string): Promise<string> {
  const buf = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode("tm-pin:" + pin)
  );
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function useNativeSettings() {
  const [settings, setSettings] = useState<NativeSettings>(loadSettings);
  useEffect(() => {
    const onChange = () => setSettings(loadSettings());
    window.addEventListener("tm-settings-changed", onChange);
    return () => window.removeEventListener("tm-settings-changed", onChange);
  }, []);
  const patch = useCallback((p: Partial<NativeSettings>) => {
    setSettings(updateSettings(p));
  }, []);
  return { settings, patch };
}
