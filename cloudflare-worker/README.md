# Cloudflare Email Worker untuk TempMail

Folder ini berisi kode **Cloudflare Email Worker** yang menjembatani **Cloudflare Email Routing** dengan backend TempMail. Email yang dikirim ke domain kamu akan diterima Cloudflare, di-forward ke Worker, lalu Worker mem-POST isinya ke webhook TempMail sehingga muncul di inbox secara real-time.

## Alur Kerja

```
┌──────────┐    ┌──────────────┐    ┌────────────────┐    ┌─────────────┐    ┌─────────┐
│ Pengirim │───▶│ Cloudflare   │───▶│ Email Routing  │───▶│ Email       │───▶│ TempMail│
│ (Gmail)  │    │ MX server    │    │ (catch-all)    │    │ Worker      │    │ Webhook │
└──────────┘    └──────────────┘    └────────────────┘    └──────┬──────┘    └────┬────┘
                                                                  │ POST JSON      │
                                                                  └───────────────▶│
                                                                                   ▼
                                                                              Inbox user
```

---

## Pilih Versi Worker

| File | Cocok untuk | Kelebihan | Batasan |
|------|-------------|-----------|---------|
| **`email-worker-simple.js`** | Deploy via **browser** (Cloudflare Dashboard editor) | Tidak butuh npm/Wrangler. Bisa langsung copy-paste ke editor web. | Body email dikirim **mentah** (raw MIME). Subject diambil dari header. HTML dan attachment tidak ter-parse otomatis. |
| **`email-worker.js`** | Deploy via **Wrangler CLI** (laptop atau Termux) | Pakai library `postal-mime` → parse HTML, text, dan encoding non-ASCII dengan benar. | Butuh `npm install postal-mime` dan deploy via Wrangler. |

> **Saran:** mulai dengan **versi simple** untuk uji koneksi. Setelah jalan, baru upgrade ke versi lengkap kalau butuh dukungan HTML/attachment yang rapi.

---

## Prasyarat

Pastikan dulu hal-hal berikut sudah ada:

- [ ] Domain kamu (mis. `clidi.net`) sudah di-add ke Cloudflare dan statusnya **Active**.
- [ ] **Email Routing** sudah di-enable di domain tersebut → MX + SPF record otomatis ditambahkan.
- [ ] Akses ke **Admin Panel TempMail** untuk mengambil **Webhook Secret**.
- [ ] App TempMail sudah di-deploy (bukan localhost) — Cloudflare Worker tidak bisa hit `localhost`.

---

## Langkah 1 — Ambil Webhook URL & Secret dari TempMail

1. Login ke app TempMail kamu sebagai admin.
2. Buka halaman **Admin → Pengaturan Umum → Cloudflare Email Routing**.
3. Di **Step 3 (Salin Webhook Secret)** → klik **"Tampilkan Webhook Secret"** → klik tombol copy.
4. Catat juga URL webhook lengkap:

```
https://<nama-app-kamu>.replit.app/api/webhook/inbound-email
```

Ganti `<nama-app-kamu>` sesuai domain deployment kamu.

---

## Langkah 2 — Deploy Worker

Pilih salah satu jalur di bawah.

### Jalur A — Cloudflare Dashboard (browser, paling cepat)

Cocok untuk `email-worker-simple.js`. Bisa dilakukan dari **HP atau laptop**.

1. Login ke [dash.cloudflare.com](https://dash.cloudflare.com) → menu **Workers & Pages** → **Create** → **Create Worker**.
2. Beri nama (contoh: `tmail`) → **Deploy** (kode default Hello World akan ter-deploy dulu).
3. Klik **Edit code** (atau **Quick edit**).
4. Buka file `cloudflare-worker/email-worker-simple.js` dari project ini → copy SELURUH isinya.
5. Di editor Cloudflare: **Ctrl+A** → **Delete** → **Paste**.
6. Klik **Save and deploy**.
7. Pesan **"Error: No fetch handler!"** di panel preview kanan adalah **wajar** — Email Worker memang tidak punya handler HTTP. Yang penting deploy berhasil.

> **Tips di mobile:** kalau paste sering kepotong, aktifkan **Situs desktop** di Chrome (titik tiga → Situs desktop), lalu zoom in. Atau pakai Jalur B di bawah.

### Jalur B — Wrangler CLI (laptop, atau Termux di Android)

Cocok untuk `email-worker.js` (versi lengkap dengan postal-mime).

**Setup di Termux (Android)** — kalau pakai laptop, langsung skip ke step 4:

```bash
pkg install nodejs git nano -y
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

**4.** Bikin `wrangler.toml`:

```toml
name = "tmail"
main = "worker.js"
compatibility_date = "2025-01-01"
```

**5.** Bikin `worker.js` — copy dari `cloudflare-worker/email-worker.js`. Install dependency-nya:

```bash
npm install postal-mime
```

**6.** Set environment secrets (akan diminta paste value-nya):

```bash
npx wrangler secret put TEMPMAIL_WEBHOOK_URL
npx wrangler secret put TEMPMAIL_WEBHOOK_SECRET
```

**7.** Deploy:

```bash
npx wrangler deploy
```

Selesai — worker sudah live.

---

## Langkah 3 — Set Environment Variables (kalau pakai Jalur A)

Kalau deploy via Wrangler, secret sudah di-set di Langkah 2/B-6. Skip ini.

Kalau deploy via Dashboard:

1. Dari halaman Worker → tab **Settings** → **Variables and Secrets** → **Add**.
2. Tambahkan 2 variable:

| Type | Variable name | Value |
|------|---------------|-------|
| `Text` | `TEMPMAIL_WEBHOOK_URL` | `https://<app-mu>.replit.app/api/webhook/inbound-email` |
| `Secret` | `TEMPMAIL_WEBHOOK_SECRET` | (paste secret dari Langkah 1) |

3. Klik **Deploy** ulang setelah variable disimpan.

---

## Langkah 4 — Hubungkan Worker ke Email Routing

1. Cloudflare Dashboard → pilih domain kamu → menu **Email** → **Email Routing** → tab **Routing rules**.
2. Pilih cara routing:

   - **Catch-all** (semua email ke domain ini → TempMail): klik **Edit** di baris Catch-all → Action: **Send to a Worker** → pilih `tmail` → **Save**.
   - **Per-alias** (cuma alamat tertentu): scroll ke **Custom addresses** → **Create address** → ketik username → Action: **Send to a Worker** → pilih `tmail`.

---

## Langkah 5 — Tambahkan Domain ke TempMail

Cloudflare boleh terima email untuk domain `clidi.net`, tapi TempMail belum tahu domain ini valid. Tambahkan dulu:

1. Admin Panel → menu **Domain** (sidebar kiri).
2. Di kolom **Domain Tersedia**, tambahkan domain kamu (contoh: `clidi.net`).
3. Klik **Simpan Perubahan**.

Setelah ini, user TempMail bisa generate alamat seperti `apa@clidi.net`.

---

## Langkah 6 — Testing

1. Di TempMail, generate alamat baru di domain Cloudflare kamu, contoh `coba123@clidi.net`.
2. Dari Gmail/Outlook pribadi, kirim email ke `coba123@clidi.net`.
3. Tunggu 5–30 detik → email harusnya muncul di inbox TempMail dengan auto-refresh.

### Cek log kalau gagal

- **Cloudflare Dashboard** → Worker `tmail` → tab **Logs** → tab **Live Logs** → kirim ulang email → lihat output.
- **Cloudflare Dashboard** → Email → **Email Routing** → tab **Activity log** → lihat status email (Delivered / Rejected / Bounced).
- **Termux/laptop** (kalau pakai Wrangler): `npx wrangler tail tmail` untuk live tail.

---

## Troubleshooting

### Paste kode sering kepotong di mobile editor Cloudflare
Editor Monaco di mobile browser sering memotong paste yang panjang. Solusi:
- Aktifkan **Situs desktop** di Chrome → editor jadi mode desktop, paste lebih reliable.
- Atau pakai **Jalur B (Wrangler CLI)** dari laptop atau Termux.
- Setelah paste, **periksa baris terakhir** di editor harus `};` (atau `}};` untuk versi 1-baris). Kalau bukan, paste ulang.

### Preview menampilkan "Error: No fetch handler!"
**Wajar untuk Email Worker.** Cloudflare panel preview mencoba HTTP request, sedangkan Email Worker hanya punya `email()` handler, bukan `fetch()`. Kode tetap berjalan saat ada email masuk.

### Error `workerd` saat `npm install wrangler` di Termux
Workerd adalah binary native untuk preview lokal — tidak ada build untuk Android ARM. Solusi: pakai flag `--ignore-scripts`:
```bash
rm -rf node_modules package-lock.json
npm install wrangler --save-dev --ignore-scripts
```
`wrangler deploy` tetap berfungsi.

### Webhook return `401 Unauthorized`
Header `X-Webhook-Secret` tidak terkirim. Cek environment variable `TEMPMAIL_WEBHOOK_SECRET` di Worker sudah di-set dan deploy ulang.

### Webhook return `403 Forbidden`
Secret tidak cocok. Buka Admin Panel → tampilkan ulang secret → pastikan persis sama (tidak ada spasi/newline) dengan value di Worker.

### Webhook return `404 Not Found`
Alamat email tujuan belum ada di database TempMail. User harus generate dulu alamatnya di TempMail sebelum kirim email ke alamat tsb.

### Webhook return `410 Gone`
Alamat email sudah kedaluwarsa (default 10 menit; bisa diperpanjang sampai 24 jam). User bisa generate ulang atau perpanjang dari UI TempMail.

### Email diterima Cloudflare tapi tidak masuk inbox
- Cek **Activity log** di Email Routing — apakah status "Delivered to Worker"?
- Cek **Worker Logs** — apakah ada error fetch ke webhook?
- Pastikan `TEMPMAIL_WEBHOOK_URL` pakai HTTPS dan domain yang benar (bukan `localhost`).
- Pastikan domain target sudah ditambahkan di Admin TempMail (Langkah 5).

---

## Catatan Tambahan

- **Email Routing gratis** — tidak ada limit jumlah email harian dari Cloudflare.
- **Workers Free Plan** — 100.000 request/hari, lebih dari cukup untuk pemakaian normal.
- Worker tidak menyimpan email apapun — Cloudflare hanya forward, semua data tersimpan di database TempMail kamu.
- Untuk multi-domain: ulangi Langkah 4 untuk setiap domain. Worker yang sama bisa dipakai untuk semua domain.
- Detail format webhook (header & body schema) ada di Admin Panel → bagian **Referensi Webhook Endpoint**.
