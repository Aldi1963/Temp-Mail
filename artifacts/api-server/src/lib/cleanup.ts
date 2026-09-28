import { db } from "@workspace/db";
import { emailAddressesTable, messagesTable } from "@workspace/db";
import { lt } from "drizzle-orm";
import { logger } from "./logger";

/**
 * Hapus pesan & alamat kedaluwarsa. Dijalankan via scheduler tiap 5 menit
 * (BUKAN per-request — full-scan DELETE di tiap request membebani DB).
 */
export async function cleanupExpiredData(): Promise<void> {
  const now = new Date();
  try {
    await db.delete(messagesTable).where(lt(messagesTable.expiresAt, now));
    await db.delete(emailAddressesTable).where(lt(emailAddressesTable.expiresAt, now));
  } catch (err) {
    logger.error({ err }, "cleanupExpiredData gagal");
  }
}

const FIVE_MIN_MS = 5 * 60 * 1000;

export function startCleanupScheduler(): void {
  cleanupExpiredData(); // jalan sekali saat start
  const t = setInterval(cleanupExpiredData, FIVE_MIN_MS);
  if (typeof (t as unknown as { unref?: () => void }).unref === "function") t.unref();
}
