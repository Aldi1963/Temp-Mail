/**
 * TempMail — Cloudflare Email Worker
 *
 * Cara deploy:
 * 1. Buka Cloudflare Dashboard → Workers & Pages → Create Worker
 * 2. Tempelkan kode ini, lalu klik Deploy
 * 3. Tambahkan Environment Variables di Worker Settings:
 *    - TEMPMAIL_WEBHOOK_URL  : https://yourapp.replit.app/api/webhook/inbound-email
 *    - TEMPMAIL_WEBHOOK_SECRET: (salin dari Panel Admin → Domain → Cloudflare Setup)
 * 4. Hubungkan Worker ke Email Routing:
 *    Cloudflare Dashboard → Email → Email Routing → Email Workers → Add
 *    Pilih worker ini, action: "Send to Worker"
 *
 * Dependensi (tambahkan di wrangler.toml atau via npm):
 *   postal-mime: parsing email MIME
 *
 * wrangler.toml minimal:
 *   name = "tempmail-email-worker"
 *   compatibility_date = "2024-01-01"
 *   [vars]
 *   TEMPMAIL_WEBHOOK_URL = "https://yourapp.replit.app/api/webhook/inbound-email"
 */

import PostalMime from "postal-mime";

export default {
  async email(message, env, ctx) {
    const webhookUrl = env.TEMPMAIL_WEBHOOK_URL;
    const webhookSecret = env.TEMPMAIL_WEBHOOK_SECRET;

    if (!webhookUrl || !webhookSecret) {
      console.error("TEMPMAIL_WEBHOOK_URL dan TEMPMAIL_WEBHOOK_SECRET harus diset di environment variables.");
      message.setReject("Server configuration error");
      return;
    }

    let parsed;
    try {
      const rawBytes = await new Response(message.raw).arrayBuffer();
      const parser = new PostalMime();
      parsed = await parser.parse(rawBytes);
    } catch (err) {
      console.error("Gagal parse email:", err);
      message.setReject("Failed to parse email");
      return;
    }

    const payload = {
      to: message.to,
      from: message.from,
      subject: parsed.subject || "(no subject)",
      textBody: parsed.text || null,
      htmlBody: parsed.html || null,
    };

    try {
      const resp = await fetch(webhookUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Webhook-Secret": webhookSecret,
        },
        body: JSON.stringify(payload),
      });

      if (!resp.ok) {
        const body = await resp.text();
        console.error(`Webhook gagal [${resp.status}]:`, body);
        if (resp.status === 404 || resp.status === 410) {
          message.setReject("Email address not found or expired");
        }
        return;
      }

      const result = await resp.json();
      console.log("Email berhasil dikirim ke TempMail:", result.messageId);
    } catch (err) {
      console.error("Gagal kirim webhook:", err);
      message.setReject("Failed to deliver email");
    }
  },
};
