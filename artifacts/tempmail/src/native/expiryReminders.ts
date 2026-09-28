// Pengingat kadaluarsa alamat via notifikasi lokal (tanpa Firebase).
//
// - Hanya berjalan di platform native (Capacitor); di web tidak melakukan apa-apa.
// - Plugin diimpor dinamis + semua kegagalan ditangkap: bila paket
//   @capacitor/local-notifications belum terpasang, izin ditolak, atau
//   penjadwalan gagal, aplikasi tetap jalan normal tanpa crash.
// - Tap notifikasi membuka aplikasi (perilaku default OS).
// - JANGAN panggil PushNotifications.register() di sini — FCM belum dikonfigurasi.
import { Capacitor } from "@capacitor/core";

interface ScheduledNotification {
  id: number;
  title: string;
  body: string;
  schedule: { at: Date };
  extra?: Record<string, string>;
}

interface LocalNotificationsPlugin {
  checkPermissions: () => Promise<{ display: string }>;
  requestPermissions: () => Promise<{ display: string }>;
  schedule: (o: { notifications: ScheduledNotification[] }) => Promise<unknown>;
  getPending: () => Promise<{ notifications: { id: number }[] }>;
  cancel: (o: { notifications: { id: number }[] }) => Promise<unknown>;
}

async function loadPlugin(): Promise<LocalNotificationsPlugin | null> {
  if (!Capacitor.isNativePlatform()) return null;
  try {
    const mod = (await import("@capacitor/local-notifications").catch(
      () => null
    )) as { LocalNotifications?: LocalNotificationsPlugin } | null;
    return mod?.LocalNotifications ?? null;
  } catch {
    return null;
  }
}

// ID tetap agar jadwal lama selalu tertimpa, bukan menumpuk.
const REMINDER_24H_ID = 9001;
const REMINDER_1H_ID = 9002;
const HOUR_MS = 60 * 60 * 1000;

// Jadwalkan pengingat H-24 jam dan H-1 jam sebelum expiresAt.
// Hanya waktu yang masih di masa depan yang dijadwalkan.
// Meminta izin notifikasi bila belum diberikan.
export async function scheduleExpiryReminders(
  email: string,
  expiresAt: string | null | undefined
): Promise<void> {
  try {
    const ln = await loadPlugin();
    if (!ln || !email) return;
    const expiryMs = Date.parse(expiresAt ?? "");
    if (Number.isNaN(expiryMs)) return;

    let perm = await ln.checkPermissions().catch(() => ({ display: "denied" }));
    if (perm.display !== "granted") {
      perm = await ln.requestPermissions().catch(() => ({ display: "denied" }));
    }
    if (perm.display !== "granted") return;

    const now = Date.now();
    const targets: { id: number; at: Date; label: string }[] = [];
    const at24h = expiryMs - 24 * HOUR_MS;
    if (at24h > now + 60_000) {
      targets.push({ id: REMINDER_24H_ID, at: new Date(at24h), label: "24 jam" });
    }
    const at1h = expiryMs - HOUR_MS;
    if (at1h > now + 60_000) {
      targets.push({ id: REMINDER_1H_ID, at: new Date(at1h), label: "1 jam" });
    }

    // Bersihkan jadwal lama dulu agar tidak menumpuk.
    await cancelExpiryReminders();
    if (targets.length === 0) return;

    await ln
      .schedule({
        notifications: targets.map((t) => ({
          id: t.id,
          title: "Alamat segera kadaluarsa",
          body: `Alamat ${email} kadaluarsa dalam ${t.label}. Ketuk untuk buka aplikasi.`,
          schedule: { at: t.at },
          extra: { email },
        })),
      })
      .catch(() => {});
  } catch {
    /* abaikan — aplikasi tetap jalan tanpa pengingat */
  }
}

// Batalkan semua notifikasi lokal yang masih terjadwal.
export async function cancelExpiryReminders(): Promise<void> {
  try {
    const ln = await loadPlugin();
    if (!ln) return;
    const pending = await ln
      .getPending()
      .catch(() => ({ notifications: [] as { id: number }[] }));
    const ids = (pending?.notifications ?? []).map((n) => ({ id: n.id }));
    if (ids.length === 0) return;
    await ln.cancel({ notifications: ids }).catch(() => {});
  } catch {
    /* abaikan */
  }
}
