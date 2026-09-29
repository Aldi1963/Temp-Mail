# Panduan Build Aplikasi Android (TempMail)

Ada 3 cara untuk membuat file APK aplikasi. Pilih yang paling nyaman.

---

## Cara 1: GitHub Actions (otomatis) ⭐ disarankan

Setiap ada push ke branch `main` yang menyentuh `artifacts/tempmail/`, APK otomatis dibuat.

**Lihat hasil build:**

1. Buka repo di GitHub → tab **Actions**
2. Klik run workflow **"Build Android APK"** yang terbaru
3. Scroll ke bawah ke bagian **Artifacts** → unduh `tempmail-debug-apk`

**Lampirkan otomatis ke Release:**

Kalau kamu membuat GitHub Release (seperti biasa), workflow otomatis membangun APK
dari kode di tag tersebut dan melampirkannya ke release. Tidak perlu upload manual lagi.

**Jalankan manual:**

Tab **Actions** → **Build Android APK** → **Run workflow** → **Run workflow**.

File workflow: [.github/workflows/android-build.yml](../.github/workflows/android-build.yml)

---

## Cara 2: Android Studio (di laptop/komputer)

Cocok kalau mau mengubah kode native (Kotlin/Java), ganti ikon, atau debug.

**Persiapan (sekali saja):**

1. Instal [Android Studio](https://developer.android.com/studio) (otomatis membawa JDK 17+)
2. Clone repo ini: `git clone https://github.com/Aldi1963/Temp-Mail.git`
3. Instal Node.js 22+ dan pnpm: `npm i -g pnpm`

**Build:**

```bash
cd Temp-Mail/artifacts/tempmail

# 1. Install dependencies
pnpm install

# 2. Build web untuk native
PORT=3100 BASE_PATH=./ VITE_API_BASE_URL=https://m.clipku.com/tempmail pnpm build:android

# 3. Sinkronkan ke project Android
./node_modules/.bin/cap sync android
```

4. Buka Android Studio → **Open** → pilih folder `artifacts/tempmail/android`
5. Tunggu Gradle sync selesai
6. Menu **Build → Build Bundle(s) / APK(s) → Build APK(s)**
7. Hasilnya di `artifacts/tempmail/android/app/build/outputs/apk/debug/app-debug.apk`
   (atau klik **locate** pada notifikasi sukses di Android Studio)

**Jalankan langsung ke HP:**

Aktifkan USB debugging di HP → colok kabel → di Android Studio pilih HP-mu →
klik tombol **Run** (▶). Aplikasi langsung terinstal & terbuka di HP.

---

## Cara 3: Manual via terminal (VPS / komputer sendiri)

Tanpa Android Studio, langsung lewat command line. Butuh: Node 22, JDK 21, Android SDK.

```bash
cd ~/temp-mail/artifacts/tempmail

export PATH=/opt/node22/bin:$PATH   # sesuaikan path Node 22

# 1. Build web untuk native
PORT=3100 BASE_PATH=./ VITE_API_BASE_URL=https://m.clipku.com/tempmail pnpm build:android

# 2. Sinkronkan ke project Android
./node_modules/.bin/cap sync android

# 3. Build APK
cd android
export JAVA_HOME=/usr/lib/jvm/java-21-openjdk-amd64   # sesuaikan
export ANDROID_HOME=$HOME/Android/Sdk                 # sesuaikan
./gradlew assembleDebug

# Hasil:
# app/build/outputs/apk/debug/app-debug.apk
```

> **Penting:** build native memakai folder `dist-native/public`, terpisah dari
> `dist/public` milik web — situs live tidak terganggu.

---

## Catatan

| Jenis file | Keterangan |
|---|---|
| **APK debug** | Untuk dites di HP sendiri (cara 1–3 di atas). Belum ditandatangani Play Store — saat instal, izinkan "sumber tidak dikenal". |
| **AAB release** | Untuk upload ke Google Play Store. Butuh keystore & akun Google Play Developer ($25). Belum disiapkan — kabari kalau mau dilanjutkan. |

**Ganti nama / ID aplikasi:** edit `appId` dan `appName` di
`artifacts/tempmail/capacitor.config.ts`, lalu `cap sync` ulang.

**Ganti ikon:** taruh file `icon.png` (1024×1024) dan `splash.png` (2732×2732) di
`artifacts/tempmail/resources/`, lalu jalankan `npx @capacitor/assets generate`.
