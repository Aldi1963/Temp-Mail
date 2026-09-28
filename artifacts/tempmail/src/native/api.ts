// Klien HTTP ringan untuk UI native Android.
import { API_BASE_URL } from "@/lib/api-base";
import { getManageToken } from "@/lib/manage-token";

const TOKEN_KEY = "tm_native_token";

export function getNativeToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setNativeToken(token: string | null): void {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* abaikan */
  }
}

// Header bukti kepemilikan alamat (untuk operasi guest).
export function manageHeaders(email: string): Record<string, string> {
  const t = getManageToken(email);
  return t ? { "X-Manage-Token": t } : {};
}

export async function nativeFetch<T = unknown>(path: string, init?: RequestInit): Promise<T> {
  const token = getNativeToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...((init?.headers as Record<string, string> | undefined) ?? {}),
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(`${API_BASE_URL}${path}`, {
    credentials: "include",
    ...init,
    headers,
  });
  let data: any = {};
  try {
    data = await res.json();
  } catch {
    /* bukan JSON */
  }
  if (!res.ok) throw new Error(data?.message || `HTTP ${res.status}`);
  return data as T;
}
