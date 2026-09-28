// Wiring Capacitor Push Notifications — graceful tanpa Firebase.
//
// - Hanya berjalan di platform native (Capacitor); di web tidak melakukan apa-apa.
// - Plugin diimpor dinamis + semua kegagalan ditangkap: bila plugin tidak ada,
//   permission ditolak, atau google-services.json belum dipasang, aplikasi tetap
//   jalan normal tanpa notifikasi (tanpa crash).
// - Registrasi token dikirim ke backend (POST /api/push/register) secara
//   fire-and-forget: bila endpoint belum ada / offline, diabaikan diam-diam.
import { Capacitor } from "@capacitor/core";
import { API_BASE_URL } from "@/lib/api-base";

// Set true setelah google-services.json dipasang + Firebase project dikonfigurasi.
// Jika false, register() FCM dilewati total — memanggil register() tanpa
// Firebase yang terinisialisasi menyebabkan NATIVE CRASH di Android
// (IllegalStateException: Default FirebaseApp is not initialized),
// yang tidak bisa ditangkap oleh try/catch JavaScript.
const FIREBASE_CONFIGURED = false;

interface PushCallbacks {
  getActiveEmail: () => string | null;
  onOpenMessage: (messageId: string, email: string) => void;
}

interface PushPlugin {
  checkPermissions: () => Promise<{ receive: string }>;
  requestPermissions: () => Promise<{ receive: string }>;
  register: () => Promise<void>;
  addListener: (event: string, cb: (data: any) => void) => Promise<unknown>;
}

let started = false;
let plugin: PushPlugin | null = null;
let lastToken: string | null = null;

async function sendRegistration(email: string | null): Promise<void> {
  if (!lastToken) return;
  try {
    await fetch(`${API_BASE_URL}/api/push/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: lastToken, email, platform: "android" }),
    });
  } catch {
    /* graceful: endpoint belum ada / offline */
  }
}

// Kirim ulang token dengan alamat aktif terbaru (mis. setelah ganti alamat).
export async function refreshPushRegistration(email: string | null): Promise<void> {
  await sendRegistration(email);
}

export async function initPushNotifications(cb: PushCallbacks): Promise<void> {
  if (started) return;
  started = true;
  try {
    if (!Capacitor.isNativePlatform()) return;

    // Impor dinamis: aman walau paket belum terpasang di node_modules.
    const mod = (await import("@capacitor/push-notifications").catch(
      () => null
    )) as { PushNotifications?: PushPlugin } | null;
    const pn = mod?.PushNotifications;
    if (!pn) return;
    plugin = pn;

    let perm = await pn.checkPermissions().catch(() => ({ receive: "denied" as string }));
    if (perm.receive === "prompt") {
      perm = await pn.requestPermissions().catch(() => ({ receive: "denied" as string }));
    }
    if (perm.receive !== "granted") return;

    await pn.addListener("registration", (data: { value?: string }) => {
      const token = data?.value;
      if (!token) return;
      lastToken = token;
      void sendRegistration(cb.getActiveEmail());
    });
    await pn.addListener("registrationError", () => {
      /* abaikan — aplikasi tetap jalan tanpa push */
    });
    await pn.addListener("pushNotificationReceived", () => {
      /* foreground: biarkan polling inbox yang menampilkan pesan */
    });
    await pn.addListener("pushNotificationActionPerformed", (n: any) => {
      const d = n?.notification?.data ?? {};
      const messageId = d.messageId ?? d.message_id;
      const email = d.email ?? cb.getActiveEmail();
      if (messageId && email) cb.onOpenMessage(String(messageId), String(email));
    });

    if (!FIREBASE_CONFIGURED) {
      // Firebase belum dipasang: jangan panggil register() sama sekali.
      // Izin notifikasi OS tetap diminta (UX), tapi tidak ada token FCM.
      return;
    }
    await pn.register().catch(() => {
      /* mis. FCM belum terkonfigurasi — tetap jalan tanpa push */
    });
  } catch {
    /* graceful: tidak ada push, aplikasi tetap normal */
  }
}

export function isPushReady(): boolean {
  return plugin !== null && lastToken !== null;
}
