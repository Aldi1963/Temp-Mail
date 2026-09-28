import type { Request, Response, NextFunction } from "express";
import { db, siteSettingsTable } from "@workspace/db";
import { inArray } from "drizzle-orm";

// Pesan default saat maintenance_message belum diatur di site_settings
export const MAINTENANCE_DEFAULT_MESSAGE = "Server sedang dalam pemeliharaan. Coba lagi nanti.";

// Cache singkat: status dibaca dari DB maksimal sekali per 10 detik agar
// tiap request /api tidak menambah satu query.
const CACHE_TTL_MS = 10_000;
let cached: { enabled: boolean; message: string; at: number } | null = null;

export function invalidateMaintenanceCache(): void {
  cached = null;
}

// Baca status maintenance dari site_settings (key maintenance_mode /
// maintenance_message). Gagal baca DB -> fail-open (dianggap mati) agar
// error DB tidak ikut memblokir API.
export async function getMaintenanceState(): Promise<{ enabled: boolean; message: string }> {
  const now = Date.now();
  if (cached && now - cached.at < CACHE_TTL_MS) return cached;

  let enabled = false;
  let message = MAINTENANCE_DEFAULT_MESSAGE;
  try {
    const rows = await db
      .select({ key: siteSettingsTable.key, value: siteSettingsTable.value })
      .from(siteSettingsTable)
      .where(inArray(siteSettingsTable.key, ["maintenance_mode", "maintenance_message"]));
    for (const row of rows) {
      if (row.key === "maintenance_mode") enabled = row.value === "true";
      else if (row.key === "maintenance_message" && row.value) message = row.value;
    }
  } catch {
    // Fail-open tanpa cache: request berikutnya mencoba baca DB lagi
    return { enabled: false, message };
  }

  cached = { enabled, message, at: now };
  return cached;
}

// Middleware Express: saat maintenance aktif, semua /api/* dijawab 503,
// kecuali /api/admin/* (agar bisa dimatikan dari panel admin) dan
// health check (agar monitor tetap hijau).
export async function maintenanceMiddleware(req: Request, res: Response, next: NextFunction): Promise<void> {
  const p = req.path;
  const isApi = p === "/api" || p.startsWith("/api/");
  if (!isApi) {
    next();
    return;
  }
  if (p === "/api/admin" || p.startsWith("/api/admin/")) {
    next();
    return;
  }
  if (p === "/api/healthz" || p === "/api/health" || p.startsWith("/api/healthz/") || p.startsWith("/api/health/")) {
    next();
    return;
  }
  const { enabled, message } = await getMaintenanceState();
  if (!enabled) {
    next();
    return;
  }
  res.status(503).json({ maintenance: true, message });
}
