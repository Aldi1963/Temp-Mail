# Cloudflare Email Worker untuk TempMail

Folder ini berisi kode **Cloudflare Email Worker** yang menjembatani **Cloudflare Email Routing** dengan backend TempMail. Email yang dikirim ke domain kamu akan diterima Cloudflare, di-forward ke Worker, lalu Worker mem-POST isinya ke webhook TempMail sehingga muncul di inbox secara real-time.

> **Bahasa:** dokumen ini sengaja ditulis dalam Bahasa Indonesia agar mudah diikuti dari HP. Istilah teknis tetap dipertahankan dalam bahasa Inggris karena UI Cloudflare berbahasa Inggris.
>
> **Terakhir diverifikasi:** April 2026 — limit/quota/pricing Cloudflare di bagian [Batasan Cloudflare](#batasan-cloudflare) dan [Catatan Tambahan](#catatan-tambahan) dapat berubah setelah tanggal ini. Selalu cek halaman dokumentasi Cloudflare resmi untuk angka terbaru.

## Daftar Isi

1. [Alur Kerja](#alur-kerja)
2. [Pilih Versi Worker](#pilih-versi-worker)
3. [Penjelasan Kode Worker](#penjelasan-kode-worker)
4. [Prasyarat](#prasyarat)
5. [Langkah 0 — Aktifkan Email Routing (sekali saja per domain)](#langkah-0--aktifkan-email-routing-sekali-saja-per-domain)
6. [Langkah 1 — Ambil Webhook URL & Secret dari TempMail](#langkah-1--ambil-webhook-url--secret-dari-tempmail)
7. [Langkah 2 — Test Webhook Dulu (opsional tapi direkomendasikan)](#langkah-2--test-webhook-dulu-opsional-tapi-direkomendasikan)
8. [Langkah 3 — Deploy Worker](#langkah-3--deploy-worker)
9. [Langkah 4 — Set Environment Variables](#langkah-4--set-environment-variables)
10. [Langkah 5 — Hubungkan Worker ke Email Routing](#langkah-5--hubungkan-worker-ke-email-routing)
11. [Langkah 6 — Tambahkan Domain ke TempMail](#langkah-6--tambahkan-domain-ke-tempmail)
12. [Langkah 7 — Testing End-to-End](#langkah-7--testing-end-to-end)
13. [Multi-Domain Setup](#multi-domain-setup)
14. [Upgrade Simple → Full](#upgrade-simple--full)
15. [Keamanan & Best Practice](#keamanan--best-practice)
16. [Batasan Cloudflare](#batasan-cloudflare)
17. [Troubleshooting Lengkap](#troubleshooting-lengkap)
18. [FAQ](#faq)
19. [Glosarium](#glosarium)
20. [Catatan Tambahan](#catatan-tambahan)

---

## Alur Kerja

```
┌──────────┐   ┌──────────────┐   ┌────────────────┐   ┌─────────────┐   ┌─────────┐
│ Pengirim │──▶│ Cloudflare   │──▶│ Email Routing  │──▶│ Email       │──▶│ TempMail│
│ (Gmail)  │   │ MX server    │   │ (catch-all)    │   │ Worker      │   │ Webhook │
└──────────┘   └──────────────┘   └────────────────┘   └──────┬──────┘   └────┬────┘
                                                              │ POST JSON     │
                                                              └──────────────▶│
                                                                              ▼
                                                                         Inbox user
```

**Detail tiap tahap:**

| Tahap | Yang terjadi | Pihak yang menanganinya |
|-------|--------------|--------------------------|
| 1 | Pengirim ketik `coba@clidi.net` di Gmail → klik Send | Penyedia email pengirim |
| 2 | Server pengirim cari MX record `clidi.net` → ketemu `route1.mx.cloudflare.net` | DNS publik |
| 3 | Email tiba di server SMTP Cloudflare | Cloudflare (gratis) |
| 4 | Routing rule cocokkan alamat tujuan → action **Send to Worker** | Email Routing |
| 5 | Worker dijalankan dengan object `message` berisi raw email | Cloudflare Workers runtime |
| 6 | Worker parse subject/body lalu `fetch()` ke webhook TempMail dengan header `X-Webhook-Secret` | Kode kamu (folder ini) |
| 7 | Backend TempMail validasi secret + alamat → simpan ke tabel `messages` | API Server (Express + Postgres) |
| 8 | Frontend TempMail polling tiap 5 detik → email muncul di inbox | React app |

---

## Pilih Versi Worker

| File | Cocok untuk | Kelebihan | Batasan |
|------|-------------|-----------|---------|
| **`email-worker-simple.js`** | Deploy via **browser** (Cloudflare Dashboard editor) | Tidak butuh npm/Wrangler. Bisa langsung copy-paste ke editor web. | Body email dikirim **mentah** (raw MIME). Subject diambil dari header. HTML dan attachment tidak ter-parse otomatis — pengguna akan melihat header MIME di body. |
| **`email-worker.js`** | Deploy via **Wrangler CLI** (laptop atau Termux) | Pakai library `postal-mime` → parse HTML, text, subject, dan encoding non-ASCII (UTF-8, Quoted-Printable, base64) dengan benar. | Butuh `npm install postal-mime` dan deploy via Wrangler. |

> **Saran:** mulai dengan **versi simple** untuk uji koneksi. Setelah jalan, baru upgrade ke versi lengkap kalau butuh tampilan HTML email yang rapi. Lihat [Upgrade Simple → Full](#upgrade-simple--full).
>
> **Catatan tentang attachment:** kedua versi worker saat ini **tidak menyimpan attachment** ke TempMail. Backend menyimpan email dengan flag `hasAttachments=false` apapun isinya. Versi lengkap unggul di parsing body/subject/encoding, bukan di pengelolaan lampiran.

---

## Penjelasan Kode Worker

### `email-worker-simple.js` — baris per baris

```js
export default {
  async email(message, env, ctx) {            // (1) handler email — bukan fetch
    const webhookUrl = env.TEMPMAIL_WEBHOOK_URL;       // (2) baca env var
    const webhookSecret = env.TEMPMAIL_WEBHOOK_SECRET;
    if (!webhookUrl || !webhookSecret) {       // (3) validasi config
      console.error(...);
      message.setReject("Server configuration error");
      return;
    }
    const subject = message.headers.get("subject") || "(tanpa subjek)"; // (4)
    const rawBody = await new Response(message.raw).text();              // (5)
    const payload = { to: message.to, from: message.from, subject, textBody: rawBody, htmlBody: null };
    const resp = await fetch(webhookUrl, {     // (6) POST ke TempMail
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Webhook-Secret": webhookSecret },
      body: JSON.stringify(payload),
    });
    if (!resp.ok && (resp.status === 404 || resp.status === 410)) {
      message.setReject("Email address not found or expired");           // (7) bounce ke pengirim
    }
  },
};
```

Penjelasan poin penting:
- **(1)** Email Worker **wajib** export `email` handler — bukan `fetch`. Itulah kenapa preview di Dashboard menampilkan "No fetch handler".
- **(3)** Kalau env var belum di-set, Worker reject email — **bukan** silently drop. Pengirim akan dapat bounce notification.
- **(5)** `message.raw` adalah `ReadableStream` MIME mentah. Versi simple kirim apa adanya (jadi body terlihat seperti `Content-Type: text/plain\r\n\r\nIsi pesan...`).
- **(7)** `message.setReject(reason)` membuat Cloudflare mengirim bounce ke pengirim. Penting untuk alamat yang sudah expired — biar pengirim tahu emailnya tidak sampai.

### `email-worker.js` — perbedaan utama

```js
import PostalMime from "postal-mime";

const rawBytes = await new Response(message.raw).arrayBuffer();  // baca sebagai bytes
const parsed = await new PostalMime().parse(rawBytes);           // parse MIME

const payload = {
  to: message.to,
  from: message.from,
  subject: parsed.subject || "(no subject)",   // sudah didecode (Quoted-Printable, UTF-8)
  textBody: parsed.text || null,                // versi text/plain saja
  htmlBody: parsed.html || null,                // versi HTML saja (rendered di iframe)
};
```

`postal-mime` menangani:
- Decoding subject `=?UTF-8?B?...?=` → string Indonesia/emoji jadi terbaca
- Pisah `multipart/alternative` → text vs HTML
- Encoding body (UTF-8, ISO-8859-1, base64, quoted-printable)

---

## Prasyarat

Pastikan dulu hal-hal berikut sudah ada:

- [ ] Domain kamu (mis. `clidi.net`) sudah di-add ke Cloudflare dan statusnya **Active** (Cloudflare Dashboard → ikon awan hijau di sebelah nama domain).
- [ ] Akun Cloudflare kamu sudah verified (cek email verifikasi dari Cloudflare).
- [ ] Akses ke **Admin Panel TempMail** untuk mengambil **Webhook Secret**.
- [ ] App TempMail sudah di-deploy (bukan localhost) — Cloudflare Worker tidak bisa hit `localhost` atau IP lokal.
- [ ] Akses ke 1 alamat email aktif (Gmail, Yahoo, dll) untuk **destination address verification** — Cloudflare wajib minta ini sebelum Email Routing aktif.

---

## Langkah 0 — Aktifkan Email Routing (sekali saja per domain)

Skip langkah ini kalau Email Routing sudah aktif (status hijau "Active" di tab Overview).

1. Cloudflare Dashboard → pilih domain (`clidi.net`) → menu **Email** → **Email Routing**.
2. Klik tombol **Get started** atau **Enable Email Routing**.
3. Cloudflare akan otomatis menambahkan 3 MX record + 1 TXT (SPF) record:
   ```
   MX  @  route1.mx.cloudflare.net  (priority 13)
   MX  @  route2.mx.cloudflare.net  (priority 38)
   MX  @  route3.mx.cloudflare.net  (priority 90)
   TXT @  "v=spf1 include:_spf.mx.cloudflare.net ~all"
   ```
   Klik **Add records and enable**.
4. **Verifikasi destination address** — Cloudflare minta minimal 1 alamat email pribadi (mis. Gmail) sebagai fallback. Masukkan email kamu → buka inbox Gmail → klik link verifikasi.
5. Setelah Step 4 selesai, status akan jadi **Active** dengan ikon hijau.

> **Catatan DNS:** kalau kamu beli domain di Cloudflare Registrar, DNS otomatis diatur. Kalau domain di registrar lain (Namecheap, GoDaddy, dll), pastikan nameserver sudah diarahkan ke Cloudflare — kalau belum, MX record di atas tidak akan aktif.

> **Domain `*.workers.dev` tidak bisa pakai Email Routing.** Email Routing wajib pakai custom domain yang aktif di Cloudflare. Subdomain dari `workers.dev` (mis. `tmail.aldiperimacom.workers.dev`) hanya untuk HTTP Workers, bukan Email Workers.

---

## Langkah 1 — Ambil Webhook URL & Secret dari TempMail

1. Login ke app TempMail kamu sebagai admin.
2. Buka halaman **Admin → Pengaturan Umum → Cloudflare Email Routing**.
3. Di **Step 3 (Salin Webhook Secret)** → klik **"Tampilkan Webhook Secret"** → klik tombol copy.
4. Catat juga URL webhook lengkap:

```
https://<nama-app-kamu>.replit.app/api/webhook/inbound-email
```

Ganti `<nama-app-kamu>` sesuai domain deployment kamu. Kalau pakai custom domain, contoh: `https://mail.clidi.net/api/webhook/inbound-email`.

---

## Langkah 2 — Test Webhook Dulu (opsional tapi direkomendasikan)

Sebelum repot deploy Worker, pastikan dulu webhook TempMail bisa dipanggil dari luar. Buka [Termux](https://termux.dev) atau terminal apa saja:

### Test 1 — tanpa secret (harus 401)

```bash
curl -i -X POST https://yourapp.replit.app/api/webhook/inbound-email \
  -H "Content-Type: application/json" \
  -d '{"to":"x@x.com","from":"y@y.com","subject":"hi","textBody":"halo"}'
```

Hasil yang benar:
```
HTTP/2 401
{"error":"Unauthorized","message":"Header X-Webhook-Secret wajib ada."}
```

### Test 2 — dengan secret salah (harus 403)

```bash
curl -i -X POST https://yourapp.replit.app/api/webhook/inbound-email \
  -H "Content-Type: application/json" \
  -H "X-Webhook-Secret: salah" \
  -d '{"to":"x@x.com","from":"y@y.com","subject":"hi","textBody":"halo"}'
```

Hasil yang benar:
```
HTTP/2 403
{"error":"Forbidden","message":"Secret tidak valid."}
```

### Test 3 — dengan secret benar + alamat tidak terdaftar (harus 404)

```bash
curl -i -X POST https://yourapp.replit.app/api/webhook/inbound-email \
  -H "Content-Type: application/json" \
  -H "X-Webhook-Secret: <secret-asli>" \
  -d '{"to":"belum-ada@clidi.net","from":"y@y.com","subject":"hi","textBody":"halo"}'
```

Hasil yang benar:
```
HTTP/2 404
{"error":"Not Found","message":"Alamat belum-ada@clidi.net tidak terdaftar."}
```

### Test 4 — full success

1. Generate alamat baru di TempMail UI, mis. `coba123@clidi.net`.
2. Jalankan:
   ```bash
   curl -i -X POST https://yourapp.replit.app/api/webhook/inbound-email \
     -H "Content-Type: application/json" \
     -H "X-Webhook-Secret: <secret-asli>" \
     -d '{"to":"coba123@clidi.net","from":"test@gmail.com","subject":"Halo dari curl","textBody":"Ini test"}'
   ```
3. Refresh inbox di TempMail — email harus muncul.

Kalau Test 4 sukses, berarti webhook **pasti** siap menerima dari Worker. Kalau gagal, perbaiki dulu sebelum lanjut.

---

## Langkah 3 — Deploy Worker

Pilih salah satu jalur di bawah.

### Jalur A — Cloudflare Dashboard (browser, paling cepat)

Cocok untuk `email-worker-simple.js`. Bisa dilakukan dari **HP atau laptop**.

1. Login ke [dash.cloudflare.com](https://dash.cloudflare.com) → menu **Workers & Pages** → **Create** → **Create Worker**.
2. Beri nama (contoh: `tmail`) → **Deploy** (kode default Hello World akan ter-deploy dulu).
3. Klik **Edit code** (atau **Quick edit**).
4. Buka file `cloudflare-worker/email-worker-simple.js` dari project ini → copy SELURUH isinya.
5. Di editor Cloudflare: **Ctrl+A** → **Delete** → **Paste**.
6. Klik **Save and deploy**.
7. Pesan **"Error: No fetch handler!"** di panel preview kanan adalah **wajar** — Email Worker memang tidak punya handler HTTP. Yang penting deploy berhasil (lihat indicator hijau di pojok atas).

> **Tips di mobile:**
> - Kalau paste sering kepotong, aktifkan **Situs desktop** di Chrome (titik tiga → Situs desktop), lalu zoom in.
> - Atau split isi Worker jadi beberapa paste kecil — paste 20 baris pertama, scroll ke bawah, paste 20 baris berikutnya, dst.
> - **Selalu cek baris terakhir** harus `};` setelah paste. Kalau bukan, paste belum komplit.
> - Atau pakai Jalur B di bawah dari Termux.

### Jalur B — Wrangler CLI (laptop, atau Termux di Android)

Cocok untuk `email-worker.js` (versi lengkap dengan postal-mime).

**Setup di Termux (Android)** — kalau pakai laptop, langsung skip ke step 4:

```bash
pkg update -y
pkg install nodejs git nano -y
node -v   # pastikan v18+
```

**1.** Bikin folder project:

```bash
mkdir tmail-worker && cd tmail-worker
npm init -y
```

**2.** Install Wrangler **tanpa workerd** (workerd binary tidak tersedia untuk Android ARM):

```bash
npm install wrangler --save-dev --ignore-scripts
```

> Flag `--ignore-scripts` skip download workerd. `wrangler dev` (preview lokal) tidak akan jalan, tapi `wrangler deploy` tetap bisa.

**3.** Login Cloudflare:

```bash
npx wrangler login
```

Buka URL yang muncul di browser, login, klik **Allow**.

> **Tip Termux:** kalau browser tidak otomatis terbuka, copy-paste URL panjang yang muncul ke Chrome manual. Setelah login, Termux akan terima callback.

**4.** Bikin `wrangler.toml`:

```toml
name = "tmail"
main = "worker.js"
compatibility_date = "2025-01-01"

[vars]
# TEMPMAIL_WEBHOOK_URL akan di-set via secret (bukan di sini), supaya tidak ter-commit ke git
```

**5.** Bikin `worker.js` — copy dari `cloudflare-worker/email-worker.js`. Install dependency-nya:

```bash
npm install postal-mime
```

**6.** Set environment secrets (akan diminta paste value-nya):

```bash
npx wrangler secret put TEMPMAIL_WEBHOOK_URL
# paste: https://yourapp.replit.app/api/webhook/inbound-email

npx wrangler secret put TEMPMAIL_WEBHOOK_SECRET
# paste secret dari Langkah 1
```

**7.** Deploy:

```bash
npx wrangler deploy
```

Output sukses:
```
Total Upload: ~50 KiB
Uploaded tmail (1.23 sec)
Deployed tmail triggers (0.45 sec)
  https://tmail.<account>.workers.dev
```

URL `workers.dev` di output **tidak akan menerima HTTP request** karena Worker ini hanya export `email` handler. Itu wajar.

---

## Langkah 4 — Set Environment Variables

**Kalau deploy via Wrangler (Jalur B):** secret sudah di-set di Langkah 3/B-6. Skip ini.

**Kalau deploy via Dashboard (Jalur A):**

1. Dari halaman Worker → tab **Settings** → **Variables and Secrets** → **Add**.
2. Tambahkan 2 variable:

| Type | Variable name | Value |
|------|---------------|-------|
| `Text` | `TEMPMAIL_WEBHOOK_URL` | `https://<app-mu>.replit.app/api/webhook/inbound-email` |
| `Secret` | `TEMPMAIL_WEBHOOK_SECRET` | (paste secret dari Langkah 1) |

> **Penting:** pilih **Secret** (bukan Text) untuk `TEMPMAIL_WEBHOOK_SECRET`. Secret di-encrypt at rest dan tidak bisa dibaca lagi setelah disimpan. Text bisa dilihat siapa saja yang akses Dashboard.

3. Klik **Deploy** ulang setelah variable disimpan — perubahan secret **tidak otomatis** ter-apply.

---

## Langkah 5 — Hubungkan Worker ke Email Routing

1. Cloudflare Dashboard → pilih domain kamu → menu **Email** → **Email Routing** → tab **Routing rules**.
2. Pilih cara routing:

   #### Opsi A — Catch-all (semua email ke domain ini → TempMail)
   - Scroll ke bagian **Catch-all address**.
   - Klik **Edit**.
   - Action: ubah dari **Drop** jadi **Send to a Worker**.
   - Pilih `tmail` di dropdown.
   - Klik **Save**.
   - Hasil: email ke `apa-aja@clidi.net` masuk ke TempMail.

   #### Opsi B — Per-alias (cuma alamat tertentu)
   - Scroll ke **Custom addresses**.
   - Klik **Create address**.
   - Custom address: ketik username (mis. `inbox` → email jadi `inbox@clidi.net`).
   - Action: **Send to a Worker**.
   - Destination: pilih `tmail`.
   - Klik **Save**.
   - Hasil: cuma `inbox@clidi.net` yang masuk TempMail; alamat lain di-bounce.

> **Saran untuk TempMail:** pakai **Catch-all**. TempMail generate alamat random, jadi semua harus diterima.

---

## Langkah 6 — Tambahkan Domain ke TempMail

Cloudflare boleh terima email untuk domain `clidi.net`, tapi TempMail belum tahu domain ini valid. Tambahkan dulu:

1. Admin Panel → menu **Domain** (sidebar kiri).
2. Di kolom **Domain Tersedia**, tambahkan domain kamu (contoh: `clidi.net`).
3. Klik **Simpan Perubahan**.

Setelah ini, user TempMail bisa generate alamat seperti `apa@clidi.net`.

> **Tanpa langkah ini**, semua email akan ditolak webhook dengan status `404 Not Found` walaupun Worker dan Cloudflare sudah benar.

---

## Langkah 7 — Testing End-to-End

1. Di TempMail, generate alamat baru di domain Cloudflare kamu, contoh `coba123@clidi.net`.
2. Dari Gmail/Outlook pribadi, kirim email ke `coba123@clidi.net`.
3. Tunggu 5–30 detik → email harusnya muncul di inbox TempMail dengan auto-refresh.

### Cek log kalau gagal

| Tempat | Cara akses | Yang dilihat |
|--------|------------|--------------|
| **Worker Logs** | Dashboard → Worker `tmail` → tab **Logs** → klik **Begin log stream** | Setiap kali Worker dijalankan: `console.log` + error |
| **Email Routing Activity** | Dashboard → Email → Email Routing → tab **Activity log** | Status email per pesan: `Forwarded`, `Worker Error`, `Rejected`, `Bounced` |
| **Wrangler tail** (Jalur B) | `npx wrangler tail tmail` di Termux/laptop | Live stream log Worker, persis seperti panel Logs di Dashboard |
| **TempMail server log** | Replit Workspace → Console workflow `api-server` | Log Express: request masuk + status response |

### Replay log untuk debug

Di tab **Logs** Worker, klik salah satu invocation → tombol **Replay** → bisa dijalankan ulang dengan input yang sama tanpa kirim email beneran. Cara cepat reproduce error tanpa nunggu email baru.

---

## Multi-Domain Setup

Worker yang sama bisa dipakai untuk **banyak domain**. Tidak perlu deploy worker baru per domain.

**Cara:**

1. Pastikan tiap domain sudah aktif Email Routing (ulangi [Langkah 0](#langkah-0--aktifkan-email-routing-sekali-saja-per-domain)).
2. Di tiap domain, ulangi [Langkah 5](#langkah-5--hubungkan-worker-ke-email-routing) — pilih worker `tmail` yang sama.
3. Di TempMail Admin, tambahkan semua domain ke daftar **Domain Tersedia** ([Langkah 6](#langkah-6--tambahkan-domain-ke-tempmail)).

**Yang harus diperhatikan:**
- Worker membaca `message.to` dari tiap email — tidak perlu hardcode domain di kode.
- Quota Workers Free Plan dibagi rata untuk **semua domain yang routing-nya pakai worker yang sama**. Kalau total email dari semua domain melebihi kuota harian, Worker akan throttled.
- Kalau mau pisah quota per-domain, deploy worker terpisah (`tmail-domain1`, `tmail-domain2`, dst) dengan kode yang sama.

---

## Upgrade Simple → Full

Sudah pakai versi simple dan mau upgrade ke versi full (parsing HTML rapi)?

1. Setup Wrangler ([Langkah 3 Jalur B](#jalur-b--wrangler-cli-laptop-atau-termux-di-android)) **dengan nama Worker yang sama** (`tmail`) — ini akan **overwrite** versi simple, bukan bikin baru.
2. Pakai `email-worker.js` sebagai `worker.js`.
3. `npm install postal-mime`.
4. **Tidak perlu** set ulang environment variables — secret `TEMPMAIL_WEBHOOK_URL` dan `TEMPMAIL_WEBHOOK_SECRET` yang lama tetap terbawa.
5. `npx wrangler deploy`.
6. **Tidak perlu** ubah Routing Rule — Worker dengan nama yang sama akan otomatis ter-update di rule.

Verifikasi: kirim email HTML (mis. dari Gmail dengan formatting bold/warna). Sebelum upgrade akan muncul sebagai header MIME mentah; setelah upgrade akan tampil sebagai HTML rapi di inbox TempMail.

---

## Keamanan & Best Practice

### Secret rotation

Kalau secret bocor (mis. ke-share screenshot, ke-commit ke git), rotate segera:

1. **Tidak bisa** rotate via Admin Panel saat ini — secret di-generate sekali saat pertama kali dipanggil.
2. Workaround: hapus row dari database, lalu trigger ulang.
   ```sql
   DELETE FROM site_settings WHERE key = 'inbound_webhook_secret';
   ```
3. Buka Admin Panel → klik **Tampilkan Webhook Secret** → secret baru auto-generated.
4. Update secret di Worker (Dashboard atau `npx wrangler secret put`).

### Jangan commit secret ke git

- `.env`, `wrangler.toml` dengan secret di `[vars]`, atau file lain berisi secret **tidak boleh** masuk git.
- Untuk Wrangler, selalu pakai `npx wrangler secret put` (bukan `[vars]` di `wrangler.toml`) supaya nilai disimpan terenkripsi di Cloudflare, bukan di file.
- Tambahkan ke `.gitignore`:
  ```
  .env
  .dev.vars
  ```

### HTTPS wajib

`TEMPMAIL_WEBHOOK_URL` **harus** pakai `https://`. HTTP plain akan ditolak Cloudflare Workers runtime di production.

### Rate limiting

Backend TempMail saat ini tidak punya rate limit di webhook endpoint. Kalau khawatir spam massal:
- Pasang Cloudflare WAF rule di depan endpoint webhook (rate limit per IP).
- Atau aktifkan Cloudflare untuk domain TempMail-nya juga (proxy enabled).

---

## Batasan Cloudflare

| Hal | Batas |
|-----|-------|
| Ukuran maksimal 1 email | **~25 MiB** (raw MIME) — email lebih besar akan di-bounce oleh Cloudflare sebelum sampai Worker |
| Total attachment | Termasuk dalam batas 25 MiB di atas |
| Workers Free CPU time | 10 ms per invocation (cukup untuk parse + 1 fetch) |
| Workers Free request | Lihat halaman pricing Cloudflare terbaru — kuota harian dapat berubah |
| Email Routing | Domain harus aktif di Cloudflare; `*.workers.dev` tidak bisa |
| Domain | Tidak bisa pakai domain yang sudah punya MX record lain (Google Workspace, dll) — MX harus eksklusif Cloudflare |

Kalau email > 25 MiB diharapkan, pertimbangkan layanan email transactional lain (Mailgun, SendGrid Inbound Parse) yang punya batas lebih besar.

---

## Troubleshooting Lengkap

### Paste kode sering kepotong di mobile editor Cloudflare
Editor Monaco di mobile browser sering memotong paste yang panjang. Solusi:
- Aktifkan **Situs desktop** di Chrome → editor jadi mode desktop, paste lebih reliable.
- Pecah paste jadi 2-3 bagian (20 baris per paste).
- Atau pakai **Jalur B (Wrangler CLI)** dari laptop atau Termux.
- Setelah paste, **periksa baris terakhir** di editor harus `};` (untuk versi simple/full multi-line) atau `}};` (kalau Worker satu baris). Kalau bukan, paste belum komplit.

### Preview menampilkan "Error: No fetch handler!"
**Wajar untuk Email Worker.** Cloudflare panel preview mencoba HTTP request, sedangkan Email Worker hanya punya `email()` handler, bukan `fetch()`. Kode tetap berjalan saat ada email masuk. Untuk test fungsi Worker, pakai **Replay** di tab Logs (lihat [Replay log](#replay-log-untuk-debug)).

### Error `workerd` saat `npm install wrangler` di Termux
Workerd adalah binary native untuk preview lokal — tidak ada build untuk Android ARM. Solusi: pakai flag `--ignore-scripts`:
```bash
rm -rf node_modules package-lock.json
npm install wrangler --save-dev --ignore-scripts
```
`wrangler deploy` tetap berfungsi (proses build di sisi Cloudflare, bukan lokal).

### Webhook return `401 Unauthorized`
Header `X-Webhook-Secret` tidak terkirim. Cek:
- Environment variable `TEMPMAIL_WEBHOOK_SECRET` di Worker sudah di-set?
- Setelah set, sudah klik **Deploy** ulang? (Jalur A)
- Worker terbaru sudah ter-deploy? (Jalur B: cek output `wrangler deploy`)

### Webhook return `403 Forbidden`
Secret tidak cocok. Cek:
- Buka Admin Panel → tampilkan ulang secret → bandingkan persis (tidak ada spasi/newline tambahan saat copy).
- Kalau pakai Wrangler: `npx wrangler secret put TEMPMAIL_WEBHOOK_SECRET` lagi untuk overwrite.

### Webhook return `404 Not Found`
Alamat email tujuan belum ada di database TempMail. Penyebab:
- User belum generate alamat tsb di TempMail UI.
- Domain sudah ditambahkan di Admin tapi typo (mis. `clidi.net` vs `clidi.com`).
- Generate alamat dulu di TempMail, baru kirim email.

### Webhook return `410 Gone`
Alamat email sudah kedaluwarsa (default 10 menit; bisa diperpanjang sampai 24 jam dari UI). Solusi:
- User generate ulang dari UI.
- Atau klik **Perpanjang** di UI selama belum lewat batas 24 jam.

### Email diterima Cloudflare tapi tidak masuk inbox
Cek satu-per-satu:
1. **Activity log** di Email Routing — status apa? (`Forwarded` = sukses, `Worker Error` = ada error di Worker, `Bounced` = pengirim ditolak)
2. **Worker Logs** — ada error fetch ke webhook? Catat status code.
3. `TEMPMAIL_WEBHOOK_URL` pakai HTTPS dan domain yang benar (bukan `localhost`, bukan IP)?
4. App TempMail benar-benar live di URL itu? (Test: `curl https://yourapp.replit.app/api/email/domains` harus return JSON)
5. Domain target sudah ditambahkan di Admin TempMail (Langkah 6)?

### Email diterima TempMail tapi body kosong / cuma header MIME
Kamu pakai `email-worker-simple.js`. Versi ini kirim raw MIME apa adanya. Solusi:
- Upgrade ke `email-worker.js` (Wrangler CLI). Lihat [Upgrade Simple → Full](#upgrade-simple--full).

### Email subject kelihatan seperti `=?UTF-8?B?...?=`
Worker simple tidak decode subject. Upgrade ke versi full dengan `postal-mime`.

### Cloudflare bilang "Email Routing requires verified destination address"
Kamu skip [Langkah 0/4](#langkah-0--aktifkan-email-routing-sekali-saja-per-domain). Cloudflare wajib minta minimal 1 destination address terverifikasi sebelum routing aktif. Tambahkan email pribadi sebagai destination → verifikasi → baru bisa lanjut.

### `No bindings configured` saat deploy Worker
Cek `wrangler.toml` punya minimal `name`, `main`, `compatibility_date`. Lihat contoh di [Langkah 3 Jalur B step 4](#jalur-b--wrangler-cli-laptop-atau-termux-di-android).

### Worker deploy sukses tapi tidak muncul di dropdown Email Routing
Worker harus pakai `email` handler (bukan `fetch`). Cek isi Worker — harus ada `async email(message, env, ctx)`. Kalau cuma ada `async fetch(...)`, Email Routing tidak akan menampilkannya.

---

## FAQ

**Q: Apakah harus punya domain berbayar?**
A: Iya. Cloudflare Email Routing wajib custom domain. Domain `.net` murah ~Rp150rb/tahun, atau pakai domain gratis dari Freenom (kalau masih buka pendaftaran).

**Q: Apakah bisa pakai 2 worker untuk 1 domain (mis. simple + full bersamaan)?**
A: Tidak. 1 routing rule = 1 worker target. Kalau mau split (mis. catch-all → worker A, custom address → worker B), bisa dengan setting per-rule berbeda.

**Q: Apakah email keluar (kirim email dari TempMail) didukung?**
A: Tidak. TempMail hanya untuk **menerima** email. Cloudflare Email Routing juga tidak support outgoing SMTP.

**Q: Apakah Reply ke email yang masuk akan diterima?**
A: Iya — selama alamat tujuan reply masih aktif (belum expired) di TempMail. Reply muncul sebagai email baru di inbox.

**Q: Apakah aman pakai untuk verifikasi 2FA / OTP banking?**
A: **Tidak disarankan.** Email TempMail bersifat publik per definisi (siapa saja yang tahu alamat bisa lihat inbox kalau alamat belum dihapus). Untuk OTP penting, pakai email/nomor HP pribadi.

**Q: Berapa lama email tersimpan?**
A: Default 10 menit dari saat alamat di-generate; bisa diperpanjang sampai 24 jam dari UI. Setelah lewat batas, alamat dan semua email-nya dihapus otomatis dari database.

**Q: Bisa kirim attachment ke TempMail?**
A: Email dengan attachment **akan diterima** Cloudflare dan webhook, tapi attachment **tidak disimpan** ke TempMail saat ini (lihat [Pilih Versi Worker](#pilih-versi-worker) → Catatan tentang attachment). Body text/HTML tetap muncul, attachment-nya saja yang hilang.

**Q: Bagaimana cara hapus Worker?**
A: Dashboard → Workers & Pages → klik nama Worker → tab **Settings** → scroll bawah → **Delete Worker**. **Sebelum hapus**, ubah dulu Routing Rule yang menunjuk ke worker ini ke action lain (mis. `Drop`), kalau tidak email akan bounce.

**Q: Apakah ada limit jumlah Worker per akun gratis?**
A: Cek halaman pricing Cloudflare terbaru — limit Worker per akun ada di sana dan bisa berubah.

---

## Glosarium

| Istilah | Arti |
|---------|------|
| **MX record** | DNS record yang memberi tahu server pengirim "kirim email untuk domain ini ke server X". Cloudflare Email Routing menambahkan 3 MX record otomatis. |
| **SPF record** | TXT record DNS yang menentukan server mana yang boleh mengirim email atas nama domain. Untuk **menerima** sebenarnya tidak perlu, tapi Cloudflare add otomatis sebagai best practice. |
| **DMARC** | Policy DNS yang menentukan apa yang dilakukan kalau SPF/DKIM gagal. Cloudflare Email Routing tidak butuh DMARC, tapi disarankan untuk domain produksi. |
| **Email Routing** | Fitur Cloudflare gratis untuk menerima email tanpa SMTP server sendiri. Email diterima Cloudflare → di-forward sesuai rule (ke email lain, ke Worker, atau di-drop). |
| **Email Worker** | Cloudflare Worker yang dipanggil saat email tiba via Email Routing. Beda dari HTTP Worker — pakai handler `email()` bukan `fetch()`. |
| **Catch-all** | Routing rule yang menangkap **semua** alamat di domain (`*@clidi.net`). Berbeda dari custom address yang cuma alamat spesifik. |
| **Webhook** | HTTP endpoint yang dipanggil oleh sistem lain saat ada event. Di sini: Worker → POST ke endpoint TempMail tiap email masuk. |
| **MIME** | Format standar email (header + body multipart). Worker dapat versi raw lewat `message.raw`. |
| **Wrangler** | CLI tool Cloudflare untuk deploy Worker dari terminal. |
| **workerd** | Runtime native untuk preview Worker lokal. Tidak tersedia untuk Android ARM. |
| **postal-mime** | Library JS untuk parse MIME jadi object `{subject, text, html, attachments}`. |
| **Bounce** | Email pengembalian otomatis ke pengirim ("Mail Delivery Failed"). Worker trigger bounce dengan `message.setReject(reason)`. |

---

## Catatan Tambahan

- **Email Routing & Workers Free Plan** — pada saat dokumen ini ditulis, Cloudflare menyediakan Email Routing tanpa biaya dan Workers Free Plan dengan kuota harian gratis yang biasanya cukup untuk pemakaian normal. **Cek halaman pricing Cloudflare terbaru** untuk angka pasti — kuota dan harga bisa berubah sewaktu-waktu.
- Worker tidak menyimpan email apapun — Cloudflare hanya forward, semua data tersimpan di database TempMail kamu.
- Untuk multi-domain: ulangi Langkah 5 untuk setiap domain. Worker yang sama bisa dipakai untuk semua domain.
- Detail format webhook (header & body schema) ada di Admin Panel → bagian **Referensi Webhook Endpoint**.
- Kalau setup buntu, jalankan dulu [Test Webhook](#langkah-2--test-webhook-dulu-opsional-tapi-direkomendasikan) untuk isolasi masalah: webhook OK + Worker gagal → masalah di Cloudflare; webhook gagal sendiri → masalah di TempMail.
