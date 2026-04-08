/**
 * TempMail — Cloudflare Email Worker (versi sederhana, tanpa npm)
 * Cocok untuk deploy via browser editor di Cloudflare Dashboard.
 *
 * Cara deploy:
 * 1. Buka Worker → Edit code → hapus semua kode lama
 * 2. Paste seluruh kode ini → klik Deploy
 * 3. Buka Settings → Variables & Secrets, tambahkan:
 *    - TEMPMAIL_WEBHOOK_URL  : https://yourapp.replit.app/api/webhook/inbound-email
 *    - TEMPMAIL_WEBHOOK_SECRET: (salin dari Admin Panel → Domain → Tampilkan Secret)
 */

export default {
  async email(message, env, ctx) {
    const webhookUrl = env.TEMPMAIL_WEBHOOK_URL;
    const webhookSecret = env.TEMPMAIL_WEBHOOK_SECRET;

    if (!webhookUrl || !webhookSecret) {
      console.error("TEMPMAIL_WEBHOOK_URL dan TEMPMAIL_WEBHOOK_SECRET belum diset!");
      message.setReject("Server configuration error");
      return;
    }

    // Ambil subject dari header email
    const subject = message.headers.get("subject") || "(tanpa subjek)";

    // Baca isi email mentah
    let rawBody = "";
    try {
      rawBody = await new Response(message.raw).text();
    } catch (err) {
      console.error("Gagal baca email:", err);
    }

    // Kirim ke TempMail webhook
    const payload = {
      to: message.to,
      from: message.from,
      subject: subject,
      textBody: rawBody,
      htmlBody: null,
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
        const errBody = await resp.text();
        console.error(`Webhook error [${resp.status}]:`, errBody);
        if (resp.status === 404 || resp.status === 410) {
          message.setReject("Email address not found or expired");
        }
        return;
      }

      console.log("Email berhasil dikirim ke TempMail inbox.");
    } catch (err) {
      console.error("Gagal kirim webhook:", err);
      message.setReject("Failed to deliver email");
    }
  },
};
