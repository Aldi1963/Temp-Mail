# Temp-Mail

[![Release](https://img.shields.io/github/v/release/Aldi1963/Temp-Mail)](https://github.com/Aldi1963/Temp-Mail/releases)
[![Android Build](https://github.com/Aldi1963/Temp-Mail/actions/workflows/android-build.yml/badge.svg)](https://github.com/Aldi1963/Temp-Mail/actions/workflows/android-build.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

Layanan email sekali pakai (disposable email) — buka halaman, langsung dapat alamat sementara, terima email & kode OTP tanpa harus daftar. Mirip temp-mail.org, tapi dengan akun opsional, API developer, dan dukungan domain sendiri (BYOD).

- **Live:** https://m.clipku.com/tempmail/
- **Dokumentasi API:** https://m.clipku.com/tempmail/api-docs
- **Unduh Android:** [releases/tempmail-debug.apk](releases/tempmail-debug.apk)

## Aplikasi Android

- **Unduh APK terbaru:** [releases/tempmail-debug.apk](releases/tempmail-debug.apk) — v1.3.0
- Versi-versi lama ada di halaman [Releases](../../releases)
- Cara pasang: hapus-instal versi lama dulu, lalu instal APK yang baru (belum ditandatangani Play Store — izinkan "instal dari sumber tidak dikenal" saat diminta)

Panduan lengkap cara build: [docs/BUILD_ANDROID.md](docs/BUILD_ANDROID.md) (GitHub Actions otomatis, Android Studio, atau manual via terminal).

Fitur khusus aplikasi: kunci PIN/biometrik, widget home screen, pengingat alamat kedaluwarsa (H-24 & H-1), salin OTP otomatis, retensi & hapus pesan otomatis per alamat, ekspor/backup alamat (JSON), teruskan pesan ke Telegram, bottom navigation ala aplikasi native.

## Fitur

### Untuk pengguna
- **Tanpa daftar** — buka halaman, langsung dapat alamat email acak
- **Inbox real-time** — refresh otomatis tiap 5 detik
- **Deteksi kode OTP otomatis** — kode 4–8 digit langsung muncul + tombol salin
- **Tampilan email rich** — HTML dirender aman di iframe tersandbox
- **Akun opsional** — login untuk menyimpan alamat & riwayat pesan
- **Dashboard** — statistik, riwayat email, label, klaim alamat guest
- **Keamanan akun** — 2FA (TOTP), ganti password, proteksi brute-force
- **Teruskan ke Telegram** — pesan baru & OTP otomatis diteruskan ke chat Telegram yang ditautkan
- **Webhook & API key** — kelola webhook dan API key developer langsung dari aplikasi/web
- **Blokir pengirim** — daftar blokir manual per email atau domain
- **Cari, arsip & favorit** — pencarian inbox, arsip pesan, dan pin alamat favorit ke paling atas
- **Label & retensi** — beri nama/label tiap alamat, atur hapus pesan otomatis (1/7/30 hari), ekspor backup JSON

### Untuk developer
- **API publik** — generate, inbox, baca/arsip/hapus pesan, blacklist, perpanjang, statistik
- **Autentikasi** — `X-API-Key` untuk akses terprogram, `X-Manage-Token` untuk operasi destruktif
- **Webhook** — terima event pesan baru (dengan validasi anti-SSRF)
- **Docs ala Postman** — coba langsung dari browser + unduh Postman Collection v2.1

### Domain sendiri (BYOD)
Sambungkan domain pribadi via Cloudflare Email Routing — verifikasi TXT + MX, worker script siap salin, secret per-domain.

### Admin
Panel admin: dashboard + grafik trafik email, manajemen pengguna (tambah, suspend/aktifkan, reset password, hapus), domain kustom, broadcast pesan, monitor server (CPU/RAM/disk/uptime), maintenance mode, log aktivitas admin, dan blokir domain spam global.

## Cara kerja email masuk

```
Pengirim ──▶ Cloudflare MX ──▶ Email Routing ──▶ Email Worker ──▶ POST /api/webhook/inbound-email ──▶ Inbox
```

## Dokumentasi

- [Panduan build aplikasi Android](docs/BUILD_ANDROID.md) — GitHub Actions otomatis, Android Studio, atau terminal
- [Panduan Cloudflare Worker](cloudflare-worker/README.md) — setup Email Routing & domain sendiri (BYOD)
- [Dokumentasi API](https://m.clipku.com/tempmail/api-docs) — coba langsung dari browser

## Struktur repo

```
.
├── .github/workflows/   # CI: build APK Android otomatis
├── artifacts/
│   ├── tempmail/        # Frontend: React + Vite + Tailwind (shadcn/ui) + Capacitor (Android)
│   └── api-server/      # Backend: Express 5 + PostgreSQL + Drizzle ORM
├── lib/
│   ├── db/              # Skema Drizzle + drizzle-kit
│   ├── api-spec/        # Spesifikasi OpenAPI
│   ├── api-zod/         # Skema validasi Zod (generated)
│   └── api-client-react/# Client React (Orval, generated)
├── cloudflare-worker/   # Worker + panduan Email Routing
├── docs/                # Panduan (build Android, dll.)
├── releases/            # APK Android terbaru (tempmail-debug.apk)
└── scripts/
    └── git-hooks/       # pre-commit hook anti-secret
```

## Menjalankan lokal

**Prasyarat:** Node.js 20+, pnpm, PostgreSQL 14+.

```bash
# 1. Install dependencies
pnpm install

# 2. Siapkan database
createdb tempmail
(cd lib/db && pnpm run push)   # sinkronkan skema via drizzle-kit

# 3. Environment — buat artifacts/api-server/.env (JANGAN di-commit!)
#    Daftar variabel: lihat tabel di bawah.

# 4. Backend
(cd artifacts/api-server && pnpm run build && pnpm start)

# 5. Frontend (terminal lain)
(cd artifacts/tempmail && pnpm dev)
```

## Environment variables

| Variabel | Keterangan |
|---|---|
| `DATABASE_URL` | Koneksi PostgreSQL (wajib) |
| `SESSION_SECRET` | Secret session login (wajib) |
| `PORT` | Port backend |
| `CORS_EXTRA_ORIGINS` | Origin tambahan untuk CORS |
| `PUBLIC_WEBHOOK_URL` | URL publik, dipakai worker script BYOD |
| `TOTP_ENCRYPTION_KEY` | Enkripsi secret 2FA (disarankan) |
| `TELEGRAM_BOT_TOKEN` | Token bot Telegram untuk fitur teruskan ke Telegram |
| `LOG_LEVEL` / `NODE_ENV` | Level log / environment |

> Nilai asli hanya ada di server — tidak pernah di-commit. Hook pre-commit otomatis menolak commit yang mengandung pola API key.

## Contoh API

```bash
# Bikin alamat
curl "https://m.clipku.com/tempmail/api/email/generate"

# Lihat inbox
curl "https://m.clipku.com/tempmail/api/email/inbox?email=kamu@domain.id"

# Operasi destruktif butuh manage token
curl -X DELETE "https://m.clipku.com/tempmail/api/email/message" \
  -H "X-Manage-Token: <token-kamu>" \
  -d '{"id":"<message-id>","email":"kamu@domain.id"}'
```

Dokumentasi lengkap + coba langsung: https://m.clipku.com/tempmail/api-docs

## Keamanan

- Secret hanya lewat environment — repo ini tidak menyimpan kredensial apapun
- Pre-commit hook memblokir pola secret umum (bypass darurat: `SKIP_SECRET_GUARD=1`)
- URL webhook divalidasi anti-SSRF (tolak IP privat/loopback/metadata cloud)
- Operasi destruktif wajib bukti kepemilikan (manage token / sesi / API key)
- Rate limit di endpoint sensitif (login, 2FA, generate)

## Alur Git

- Satu fitur = satu commit, pesan model `feat:` / `fix:` / `chore:` (lihat `git log`)
- Jangan commit `node_modules/`, `dist/`, `.env` (sudah di `.gitignore`)
- Pengecualian: `releases/tempmail-debug.apk` memang sengaja di-commit (satu file, ditimpa tiap rilis)

## Lisensi

MIT — lihat [LICENSE](LICENSE).
