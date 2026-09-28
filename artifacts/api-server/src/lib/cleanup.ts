import { db } from "@workspace/db";
import { emailAddressesTable, messagesTable } from "@workspace/db";
import { and, eq, isNotNull, lt } from "drizzle-orm";
import { logger } from "./logger";

/**
 * Hapus pesan & alamat kedaluwarsa. Dijalankan via scheduler tiap 5 menit
 * (BUKAN per-request — full-scan DELETE di tiap request membebani DB).
 *
 * Juga menghapus permanen pesan di tong sampah yang deleted_at-nya
 * sudah lebih dari 24 jam lalu.
 */
export async function cleanupExpiredData(): Promise<void> {
  const now = new Date();
  try {
    await db.delete(messagesTable).where(lt(messagesTable.expiresAt, now));
    await db.delete(emailAddressesTable).where(lt(emailAddressesTable.expiresAt, now));
    // Tong sampah: hapus permanen pesan yang dihapus > 24 jam lalu
    const trashCutoff = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    await db.delete(messagesTable).where(lt(messagesTable.deletedAt, trashCutoff));
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

/**
 * Retensi hapus pesan otomatis per alamat.
 *
 * Untuk setiap alamat dengan auto_delete_days terisi (1/7/30), hapus PERMANEN
 * pesan yang received_at-nya lebih tua dari N hari. Dijalankan via scheduler
 * tiap 1 jam. Kegagalan DB ditangkap agar tidak menjatuhkan proses.
 */
export async function cleanupAutoDeleteRetention(): Promise<void> {
  const now = new Date();
  try {
    const addrs = await db
      .select({
        email: emailAddressesTable.email,
        days: emailAddressesTable.autoDeleteDays,
      })
      .from(emailAddressesTable)
      .where(isNotNull(emailAddressesTable.autoDeleteDays));

    let totalDeleted = 0;
    for (const a of addrs) {
      const days = a.days;
      if (!days || days <= 0) continue; // lewati nilai tidak valid
      const cutoff = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
      const deleted = await db
        .delete(messagesTable)
        .where(
          and(eq(messagesTable.email, a.email), lt(messagesTable.receivedAt, cutoff))
        )
        .returning({ id: messagesTable.id });
      if (deleted.length > 0) {
        logger.info(
          { email: a.email, autoDeleteDays: days, count: deleted.length },
          "retensi: pesan lama dihapus permanen"
        );
      }
      totalDeleted += deleted.length;
    }
    logger.info(
      { addresses: addrs.length, deletedMessages: totalDeleted },
      "cleanup retensi hapus pesan selesai"
    );
  } catch (err) {
    logger.error({ err }, "cleanupAutoDeleteRetention gagal");
  }
}

const ONE_HOUR_MS = 60 * 60 * 1000;

export function startRetentionScheduler(): void {
  cleanupAutoDeleteRetention(); // jalan sekali saat start
  const t = setInterval(cleanupAutoDeleteRetention, ONE_HOUR_MS);
  if (typeof (t as unknown as { unref?: () => void }).unref === "function") t.unref();
}
