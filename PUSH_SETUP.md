# Setup Push Notification (Aplikasi Android TempMail)

Notifikasi push memakai Firebase Cloud Messaging (FCM) via plugin
`@capacitor/push-notifications`. Aplikasi **tetap jalan normal tanpa Firebase**
— notifikasi hanya tidak aktif sampai langkah di bawah selesai.

Package name aplikasi: `com.clipku.tempmail` (lihat `artifacts/tempmail/capacitor.config.ts`).

## Langkah 1 — Buat Firebase project & aplikasi Android

1. Buka [Firebase Console](https://console.firebase.google.com/) → **Add project**
   (atau pakai project yang sudah ada).
2. Di Project Overview → **Add an app** → pilih **Android**.
3. Isi **Android package name**: `com.clipku.tempmail`
   (App nickname bebas, mis. "TempMail Android").
4. Download file **`google-services.json`**.
5. Salin file tersebut ke: `artifacts/tempmail/android/app/google-services.json`
   (sejajar dengan `build.gradle`).
6. Tidak perlu menambahkan Firebase SDK manual — plugin Capacitor sudah
   mengurusnya. File `android/app/build.gradle` otomatis memakai plugin
   `google-services` **hanya jika** `google-services.json` ada; tanpanya build
   tetap sukses.

## Langkah 2 — Backend: service account + endpoint `/api/push/register`

> **Catatan koordinator:** endpoint ini BELUM ada di backend. Frontend sudah
> mengirim `POST /api/push/register` secara fire-and-forget (aman bila 404).

1. Firebase Console → **Project settings** → tab **Service accounts** →
   **Generate new private key** → download file JSON.
2. Salin JSON key ke server, mis. `/home/ubuntu/temp-mail/firebase-service-account.json`.
3. Tambahkan ke `/home/ubuntu/temp-mail/.env`:
   ```
   FIREBASE_SERVICE_ACCOUNT_JSON=/home/ubuntu/temp-mail/firebase-service-account.json
   ```
4. Implementasikan di backend (api-server):
   - `POST /api/push/register` menerima `{ token, email, platform }` → simpan
     token per alamat email (tabel baru, mis. `push_tokens`).
   - Saat pesan baru masuk (webhook inbound), kirim FCM ke token-token milik
     alamat tujuan dengan payload:
     ```json
     { "data": { "messageId": "<id pesan>", "email": "<alamat tujuan>" } }
     ```
     Aplikasi membuka pesan terkait saat notifikasi diketuk.
5. Restart backend:
   ```
   pm2 restart tempmail-web
   ```

## Langkah 3 — Rebuild APK

1. Di `artifacts/tempmail`:
   ```
   export PATH=/opt/node22/bin:$PATH
   pnpm install
   npx cap sync android
   ```
2. Build release/debug seperti biasa (`./gradlew assembleDebug` di
   `artifacts/tempmail/android`).
3. Di HP: buka aplikasi → izinkan notifikasi saat diminta → token otomatis
   terdaftar ke backend dengan alamat aktif.

## Verifikasi

- Kirim email ke alamat aktif di aplikasi → notifikasi muncul di HP.
- Ketuk notifikasi → aplikasi membuka pesan tersebut.
- Matikan izin notifikasi di pengaturan HP → aplikasi tetap jalan normal
  (mode graceful, tanpa crash).
