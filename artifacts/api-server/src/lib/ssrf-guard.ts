import { lookup } from "dns/promises";
import { isIP, isIPv4 } from "net";

/** Rentang IPv4 privat/terlarang (termasuk metadata cloud 169.254.169.254). */
function isBlockedIPv4(ip: string): boolean {
  const p = ip.split(".").map(Number);
  if (p.length !== 4 || p.some((n) => Number.isNaN(n) || n < 0 || n > 255)) return true;
  const [a, b] = p;
  if (a === 10) return true; // 10.0.0.0/8
  if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12
  if (a === 192 && b === 168) return true; // 192.168.0.0/16
  if (a === 127) return true; // 127.0.0.0/8 loopback
  if (a === 169 && b === 254) return true; // 169.254.0.0/16 link-local + metadata
  if (a === 0) return true; // 0.0.0.0/8
  if (a === 192 && b === 0 && p[2] === 2) return true; // TEST-NET-1
  if (a === 198 && (b === 51 || b === 18)) return true; // TEST-NET-2/benchmark
  if (a === 203 && b === 0 && p[2] === 113) return true; // TEST-NET-3
  if (a >= 224) return true; // multicast + reserved
  return false;
}

function isBlockedIP(ip: string): boolean {
  if (isIPv4(ip)) return isBlockedIPv4(ip);
  // IPv6: tolak loopback/link-local; izinkan hanya unicast global
  const low = ip.toLowerCase();
  if (low === "::1") return true;
  if (low.startsWith("fe80:")) return true;
  if (low.startsWith("fc") || low.startsWith("fd")) return true; // unique local
  return false;
}

/**
 * Validasi URL webhook: hanya http/https, hostname harus resolve ke IP publik.
 * Dipakai saat registrasi DAN saat trigger (anti DNS-rebinding).
 * @returns null bila aman, atau pesan error bila ditolak.
 */
export async function validateWebhookUrl(rawUrl: string): Promise<string | null> {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return "URL tidak valid.";
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return "Hanya URL http/https yang diizinkan.";
  }
  if (parsed.username || parsed.password) {
    return "URL tidak boleh mengandung kredensial.";
  }
  const host = parsed.hostname;
  // Blokir nama host yang jelas-jelas internal
  if (["localhost", "localhost.localdomain"].includes(host.toLowerCase())) {
    return "Host internal tidak diizinkan.";
  }
  try {
    if (isIP(host)) {
      if (isBlockedIP(host)) return "IP privat/internal tidak diizinkan.";
    } else {
      const { address } = await lookup(host, { family: 4 });
      if (isBlockedIP(address)) return "Hostname resolve ke IP privat/internal.";
    }
  } catch {
    return "Hostname tidak bisa di-resolve.";
  }
  return null;
}
