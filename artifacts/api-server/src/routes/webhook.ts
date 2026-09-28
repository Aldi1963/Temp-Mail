import { Router } from "express";
import { randomUUID, timingSafeEqual } from "crypto";
import { db } from "@workspace/db";
import {
  emailAddressesTable,
  messagesTable,
  siteSettingsTable,
  activityLogsTable,
  usersTable,
  customDomainsTable,
} from "@workspace/db";
import { eq, inArray, desc, and, isNull } from "drizzle-orm";
import { requireAdmin } from "../lib/auth.js";
import { triggerWebhooksForEmail } from "./developer.js";
import { secretMatches, findCustomDomainBySecret } from "./custom-domains.js";
import { notifyNewMessagePush } from "../lib/fcm.js";

const router = Router();

async function getInboundSecret(): Promise<string> {
  const rows = await db
    .select()
    .from(siteSettingsTable)
    .where(eq(siteSettingsTable.key, "inbound_webhook_secret"));

  if (rows.length > 0) return rows[0].value;

  const secret = randomUUID().replace(/-/g, "") + randomUUID().replace(/-/g, "");
  await db
    .insert(siteSettingsTable)
    .values({ key: "inbound_webhook_secret", value: secret, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: siteSettingsTable.key,
      set: { value: secret, updatedAt: new Date() },
    });
  return secret;
}

router.get("/inbound-secret", requireAdmin, async (_req, res) => {
  const secret = await getInboundSecret();
  res.json({ secret });
});

// Helper to parse MIME into clean text and html
function parseMimeContent(raw: string): { text: string; html: string | null } {
  if (!raw) return { text: "", html: null };

  // Find all boundaries (handles nested multipart like Canva / Amazon SES)
  const boundaryRegex = /boundary="?([^"\r\n;]+)"?/gi;
  const boundaries: string[] = [];
  let bm: RegExpExecArray | null;
  while ((bm = boundaryRegex.exec(raw)) !== null) {
    boundaries.push(bm[1]);
  }

  let extractedText = "";
  let extractedHtml: string | null = null;

  function decodeQp(s: string): string {
    if (!s) return "";
    return s
      .replace(/=\r?\n/g, "")
      .replace(/=([0-9A-Fa-f]{2})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
  }

  function cleanPart(partStr: string): string {
    const bodyStart = partStr.indexOf("\r\n\r\n") !== -1 ? partStr.indexOf("\r\n\r\n") + 4 : partStr.indexOf("\n\n") !== -1 ? partStr.indexOf("\n\n") + 2 : -1;
    let body = bodyStart !== -1 ? partStr.slice(bodyStart) : partStr;
    // Strip trailing MIME boundary delimiter lines only (RFC 2046: "--" at a
    // line start followed by boundary chars). The previous /--[^\r\n-]+--?/
    // also matched HTML comment closers ("-->") and ate the markup after them
    // up to the next "-", leaving unclosed <!--[if mso]> comments that
    // blanked MJML/HTML emails in the viewer.
    body = body.replace(/(?:\r\n|\n|^)--[A-Za-z0-9'()+_,./:=?\- ]+(?:--)?(?=\r\n|\n|$)/g, "").trim();
    // Strip leading Content-Type or headers if not stripped
    body = body.replace(/^-?Content-Type:[^\n\r]*[\r\n]*/gim, "");
    body = body.replace(/^Content-Transfer-Encoding:[^\n\r]*[\r\n]*/gim, "");
    body = body.replace(/^Content-Disposition:[^\n\r]*[\r\n]*/gim, "");
    return decodeQp(body.trim());
  }

  // A part is a container (not a leaf) when its own headers declare multipart.
  // Container chunks (e.g. multipart/alternative inside multipart/related)
  // contain the inner Content-Type lines, so they must be skipped — otherwise
  // the text and html bodies get mixed into one blob.
  function isLeafPart(partStr: string): boolean {
    const rn = partStr.indexOf("\r\n\r\n");
    const n = partStr.indexOf("\n\n");
    const end = rn !== -1 ? rn : n !== -1 ? n : partStr.length;
    return !/content-type:\s*multipart\//i.test(partStr.slice(0, end));
  }

  if (boundaries.length > 0) {
    // Innermost boundary first (last found = deepest nesting): the real leaf
    // text/plain and text/html parts win over container chunks.
    for (let i = boundaries.length - 1; i >= 0; i--) {
      const b = boundaries[i];
      const escaped = b.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&");
      const parts = raw.split(new RegExp(`--${escaped}(?:--)?`));
      for (const part of parts) {
        if (part.includes("Content-Type: text/plain") && !extractedText && isLeafPart(part)) {
          extractedText = cleanPart(part);
        }
        if (part.includes("Content-Type: text/html") && !extractedHtml && isLeafPart(part)) {
          extractedHtml = cleanPart(part);
        }
      }
      if (extractedText && extractedHtml) break;
    }
  }

  // Single part with headers
  if (!extractedText && !extractedHtml) {
    const headerEnd = raw.indexOf("\r\n\r\n") !== -1 ? raw.indexOf("\r\n\r\n") + 4 : raw.indexOf("\n\n") !== -1 ? raw.indexOf("\n\n") + 2 : -1;
    if (headerEnd !== -1 && (raw.includes("Received:") || raw.includes("Content-Type:") || raw.includes("ARC-Seal:"))) {
      const bodyOnly = raw.slice(headerEnd).trim();
      if (bodyOnly) {
        extractedText = decodeQp(bodyOnly);
      }
    }
  }

  return {
    text: extractedText || raw,
    html: extractedHtml,
  };
}

router.post("/inbound-email", async (req, res) => {
  const authHeader = req.headers["x-webhook-secret"] as string | undefined;

  if (!authHeader) {
    res.status(401).json({ error: "Unauthorized", message: "Header X-Webhook-Secret wajib ada." });
    return;
  }

  const { to, from: fromAddr, subject, textBody, htmlBody } = req.body ?? {};

  if (!to || !fromAddr) {
    res.status(400).json({ error: "Bad request", message: "Field 'to' dan 'from' wajib diisi." });
    return;
  }

  const toEmail = String(to).toLowerCase().trim();
  const fromEmail = String(fromAddr).trim();

  const expectedSecret = await getInboundSecret();
  let authed = secretMatches(authHeader, expectedSecret);
  if (!authed) {
    // Coba secret per-domain kustom (worker dipasang di akun Cloudflare user)
    const cd = await findCustomDomainBySecret(authHeader, toEmail);
    authed = cd !== null;
  }
  if (!authed) {
    res.status(403).json({ error: "Forbidden", message: "Secret tidak valid." });
    return;
  }

  const addrRows = await db
    .select()
    .from(emailAddressesTable)
    .where(eq(emailAddressesTable.email, toEmail))
    .limit(1);

  if (addrRows.length === 0) {
    res.status(404).json({ error: "Not Found", message: `Alamat ${toEmail} tidak terdaftar.` });
    return;
  }

  const addr = addrRows[0];
  const now = new Date();

  if (addr.expiresAt < now) {
    res.status(410).json({ error: "Gone", message: "Alamat email ini sudah kedaluwarsa." });
    return;
  }

  // Domain kustom: harus aktif dan dimiliki pemilik alamat
  const addrDomain = toEmail.slice(toEmail.lastIndexOf("@") + 1);
  const cdRows = await db
    .select()
    .from(customDomainsTable)
    .where(eq(customDomainsTable.domain, addrDomain))
    .limit(1);
  if (cdRows.length > 0) {
    if (cdRows[0].status !== "active" || cdRows[0].userId !== addr.userId) {
      res.status(410).json({ error: "Gone", message: "Domain pengirim tidak aktif." });
      return;
    }
  }

  let subjectStr = subject ? String(subject).trim() : "(tanpa subjek)";
  let textStr = textBody ? String(textBody) : null;
  let htmlStr = htmlBody ? String(htmlBody) : null;
  let cleanFrom = fromEmail;

  // Auto-parse MIME headers if Cloudflare simple worker forwarded raw MIME
  if (textStr && (textStr.includes("Received:") || textStr.includes("Content-Type:") || textStr.includes("boundary="))) {
    // Extract real From display name (e.g., "From: Canva <no-reply@canva.com>" or "From: Aldi Irawan <...>")
    const fromMatch = textStr.match(/^From:\s*(.*)$/im);
    if (fromMatch && fromMatch[1].trim()) {
      cleanFrom = fromMatch[1].trim();
    }

    // Extract Subject from header if subject was empty
    const subjMatch = textStr.match(/^Subject:\s*(.*)$/im);
    if (subjMatch && subjMatch[1].trim() && (subjectStr === "(no subject)" || subjectStr === "(tanpa subjek)")) {
      subjectStr = subjMatch[1].trim();
    }
    const parsed = parseMimeContent(textStr);
    textStr = parsed.text || textStr;
    if (parsed.html && !htmlStr) {
      htmlStr = parsed.html;
    }
  }

  // Single-part HTML emails sometimes land in textBody (worker / MIME fallback).
  // Keep a copy in htmlBody so clients render rich HTML; textBody stays for OTP scan.
  if (!htmlStr && textStr && /^\s*(<!doctype html|<html[\s>])/i.test(textStr)) {
    htmlStr = textStr;
  }

  // Generate clean readable preview snippet (strip <style>, CSS rules, HTML tags)
  let cleanSnippet = (textStr || htmlStr || "");
  cleanSnippet = cleanSnippet.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "");
  cleanSnippet = cleanSnippet.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "");
  cleanSnippet = cleanSnippet.replace(/@media[^{]+\{[\s\S]*?\}/gi, "");
  cleanSnippet = cleanSnippet.replace(/\*?\[class\][^{]+\{[^}]+\}/gi, "");
  cleanSnippet = cleanSnippet.replace(/<[^>]+>/g, " ");
  cleanSnippet = cleanSnippet.replace(/&nbsp;/gi, " ");
  cleanSnippet = cleanSnippet.replace(/Â\s*/g, "");
  cleanSnippet = cleanSnippet.replace(/â\u0080\u008C/g, ""); // strip ZWNJ mojibake
  cleanSnippet = cleanSnippet.replace(/â[^\s]{1,4}/g, ""); // strip corrupt UTF-8 multi-byte chars
  cleanSnippet = cleanSnippet.replace(/[\u200B-\u200D\uFEFF\u00A0]/g, ""); // strip zero-width chars
  cleanSnippet = cleanSnippet.replace(/\s+/g, " ").trim();

  const preview = cleanSnippet.slice(0, 200);

  const messageId = randomUUID();

  await db.insert(messagesTable).values({
    id: messageId,
    email: toEmail,
    fromAddress: cleanFrom,
    toAddress: toEmail,
    subject: subjectStr,
    textBody: textStr,
    htmlBody: htmlStr,
    preview,
    isRead: false,
    hasAttachments: false,
    attachmentsJson: "[]",
    receivedAt: now,
    expiresAt: addr.expiresAt,
  });

  await triggerWebhooksForEmail(toEmail, "new_message", {
    messageId,
    from: cleanFrom,
    to: toEmail,
    subject: subjectStr,
    preview,
    receivedAt: now.toISOString(),
  });

  // Push notification ke aplikasi Android (FCM) — fire-and-forget,
  // gagal total = dilewati diam-diam (lihat lib/fcm.ts).
  try {
    notifyNewMessagePush(toEmail, { from: cleanFrom, subject: subjectStr, messageId });
  } catch {
    /* non-fatal */
  }

  if (addr.userId) {
    try {
      await db.insert(activityLogsTable).values({
        userId: addr.userId,
        action: "email_received",
        description: `Email baru dari ${cleanFrom}`,
        metadata: JSON.stringify({ from: cleanFrom, subject: subjectStr, to: toEmail }),
      });
    } catch {
      /* non-fatal */
    }
  }

  // Auto-Forward to Telegram Bot if target user has telegramChatId or global fallback
  try {
    const settingsRows = await db.select().from(siteSettingsTable);
    const settingsMap: Record<string, string> = {};
    for (const r of settingsRows) {
      settingsMap[r.key] = r.value;
    }

    const tgToken = settingsMap.telegram_bot_token || process.env.TELEGRAM_BOT_TOKEN;
    let targetChatId: string | null = null;

    // 1. Cek apakah pemilik alamat email ini adalah user terdaftar yang mengisi Chat ID
    if (addr.userId) {
      const [u] = await db
        .select({ telegramChatId: usersTable.telegramChatId })
        .from(usersTable)
        .where(eq(usersTable.id, addr.userId))
        .limit(1);
      if (u && u.telegramChatId) {
        targetChatId = u.telegramChatId;
      }
    }

    // 2. Jika tidak ada Chat ID user, fallback ke Chat ID global admin jika diaktifkan
    if (!targetChatId && settingsMap.telegram_forward_enabled === "true") {
      targetChatId = settingsMap.telegram_chat_id || process.env.TELEGRAM_CHAT_ID || null;
    }

    if (tgToken && targetChatId) {
      // Hormati preferensi notifikasi per-user (/notif)
      if (settingsMap[`tg_notif_${targetChatId}`] === "off") {
        res.json({ success: true, messageId, to: toEmail, notified: false });
        return;
      }
      // Extract OTP if present
      const otpMatch = (cleanSnippet || textStr || "").match(/\b(?:code|kode|otp|pin|verifikasi|token|verification)[^\d]{1,20}(\d{4,8})\b/i)
        || (cleanSnippet || textStr || "").match(/\b(\d{6})\b/);
      const otpCode = otpMatch ? (otpMatch[1] || otpMatch[0]) : null;

      // Extract verification link if present
      const linkMatch = (textStr || "").match(/https?:\/\/[^\s<>"']+(?:verify|confirm|activate|auth|login|token|code)[^\s<>"']*/i)
        || (textStr || "").match(/https?:\/\/[^\s<>"']{15,}/i);
      const verifyUrl = linkMatch ? linkMatch[0] : null;

      let msg = `📬 *Email Baru Masuk ke TempMail*\n\n`;
      msg += `👤 *Dari:* \`${cleanFrom}\`\n`;
      msg += `🎯 *Ke:* \`${toEmail}\`\n`;
      msg += `📌 *Subjek:* *${subjectStr}*\n`;
      if (otpCode) {
        msg += `🔑 *KODE OTP:* \`${otpCode}\`\n`;
      }
      if (cleanSnippet) {
        msg += `\n💬 *Cuplikan:*\n_${cleanSnippet.slice(0, 180)}_\n`;
      }

      // Interactive Action Buttons
      const inlineKeyboard: any[] = [];
      if (otpCode) {
        inlineKeyboard.push([
          { text: `📋 Salin OTP: ${otpCode}`, copy_text: { text: otpCode } }
        ]);
      }
      const actionRow: any[] = [
        { text: "📖 Baca Pesan", callback_data: `read_${messageId}` },
        { text: "🗑️ Hapus", callback_data: `del_${messageId}` }
      ];
      if (verifyUrl) {
        actionRow.unshift({ text: "🔗 Buka Link", url: verifyUrl });
      }
      inlineKeyboard.push(actionRow);

      fetch(`https://api.telegram.org/bot${tgToken}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: targetChatId,
          text: msg,
          parse_mode: "Markdown",
          disable_web_page_preview: true,
          reply_markup: {
            inline_keyboard: inlineKeyboard
          }
        }),
      }).catch(() => {});

      // UX: kirim OTP sebagai pesan terpisah agar mudah disalin
      if (otpCode) {
        const otpMsg =
          `🔑 *Kode OTP*\n\n` +
          `\`${otpCode}\`\n\n` +
          `📌 Subjek: ${subjectStr}\n` +
          `👤 Dari: \`${cleanFrom}\`\n\n` +
          `_Ketuk kode di atas untuk menyalin_`;
        fetch(`https://api.telegram.org/bot${tgToken}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: targetChatId,
            text: otpMsg,
            parse_mode: "Markdown",
          }),
        }).catch(() => {});
      }
    }
  } catch {
    /* non-fatal */
  }

  res.json({ success: true, messageId, to: toEmail });
});

// State storage for interactive user flow (e.g. waiting for custom username)
const userFlowState = new Map<string, { action: string; timestamp: number }>();
const emailListCache = new Map<string, string[]>(); // daftar /emails terakhir per chat

// Helper to strip HTML tags, CSS, style blocks, and technical MIME routing
function getCleanReadableText(raw: string): string {
  if (!raw) return "";
  let text = raw;

  // If text contains HTML doctype or body, strip styles and tags
  text = text.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "");
  text = text.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "");
  text = text.replace(/<!--[\s\S]*?-->/g, "");
  text = text.replace(/<[^>]+>/g, " ");

  // Strip CSS block leftovers like @media ... { ... } or classes
  text = text.replace(/@media[^{]+\{[\s\S]*?\}/gi, "");
  text = text.replace(/\*?\[class\][^{]+\{[^}]+\}/gi, "");
  text = text.replace(/\.[a-zA-Z0-9_-]+\{[^}]+\}/gi, "");

  // Strip MIME header lines
  text = text.replace(/^-?Content-Type:[^\n\r]*[\r\n]*/gim, "");
  text = text.replace(/^Content-Transfer-Encoding:[^\n\r]*[\r\n]*/gim, "");
  text = text.replace(/^Content-Disposition:[^\n\r]*[\r\n]*/gim, "");
  text = text.replace(/^Received:[^\n\r]*[\r\n]*/gim, "");
  text = text.replace(/^ARC-[^\n\r]*[\r\n]*/gim, "");
  text = text.replace(/^DKIM-[^\n\r]*[\r\n]*/gim, "");
  text = text.replace(/--[a-z0-9._-]+/gi, "");

  // Strip non-breaking space artifacts & HTML entities
  text = text.replace(/Â\s*/g, "");
  text = text.replace(/â\u0080\u008C/g, "");
  text = text.replace(/â[^\s]{1,4}/g, "");
  text = text.replace(/[\u200B-\u200D\uFEFF\u00A0]/g, "");
  text = text.replace(/&nbsp;/gi, " ");
  text = text.replace(/&amp;/gi, "&");
  text = text.replace(/&lt;/gi, "<");
  text = text.replace(/&gt;/gi, ">");
  text = text.replace(/&quot;/gi, '"');
  text = text.replace(/&#39;/gi, "'");

  // Collapse multiple empty lines
  text = text.replace(/\r\n/g, "\n");
  text = text.replace(/[ \t]+/g, " ");
  text = text.replace(/\n\s*\n\s*\n+/g, "\n\n");

  return text.trim();
}

// ─── 2-WAY INTERACTIVE TELEGRAM BOT WEBHOOK ─────────────────────────────────
router.post("/telegram", async (req, res) => {
  // [SECURITY] Verifikasi secret webhook Telegram. Tanpa ini, siapa pun bisa
  // POST update palsu dengan chat.id korban dan mencuri OTP/inbox via bot.
  // Secret di-set via Telegram setWebhook(secret_token=TELEGRAM_WEBHOOK_SECRET).
  const tgWebhookSecret = process.env.TELEGRAM_WEBHOOK_SECRET || "";
  const provided = req.headers["x-telegram-bot-api-secret-token"];
  const secretOk =
    tgWebhookSecret.length > 0 &&
    typeof provided === "string" &&
    provided.length === tgWebhookSecret.length &&
    timingSafeEqual(Buffer.from(provided, "utf8"), Buffer.from(tgWebhookSecret, "utf8"));
  if (!secretOk) {
    res.status(403).json({ ok: false, error: "Forbidden" });
    return;
  }

  res.json({ ok: true }); // Always ack Telegram immediately

  const update = req.body;
  if (!update) return;

  // Retrieve bot token from site_settings or env
  const settingsRows = await db.select().from(siteSettingsTable);
  const settingsMap: Record<string, string> = {};
  for (const r of settingsRows) settingsMap[r.key] = r.value;
  const tgToken = settingsMap.telegram_bot_token || process.env.TELEGRAM_BOT_TOKEN;
  if (!tgToken) return;

  // Helper send telegram message
  const sendTg = async (chatId: number | string, text: string, replyMarkup?: any) => {
    fetch(`https://api.telegram.org/bot${tgToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: "Markdown",
        reply_markup: replyMarkup,
        disable_web_page_preview: true,
      }),
    }).catch(() => {});
  };

  // Helper edit telegram message
  const editTg = async (chatId: number | string, messageId: number, text: string, replyMarkup?: any) => {
    fetch(`https://api.telegram.org/bot${tgToken}/editMessageText`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        message_id: messageId,
        text,
        parse_mode: "Markdown",
        reply_markup: replyMarkup,
        disable_web_page_preview: true,
      }),
    }).catch(() => {});
  };

  // ── KEYBOARD STATE GENERATOR ───────────────────────────────────────────────
  // Default: Menu Utama (Home Hub)
  const homeKeyboard = {
    keyboard: [
      [{ text: "⚡ Buat Email Baru" }, { text: "📥 Kotak Masuk" }],
      [{ text: "🔑 Ambil Kode OTP" }, { text: "📧 Email Saya" }],
      [{ text: "📋 Salin Email" }, { text: "📊 Statistik" }],
      [{ text: "🔔 Notifikasi" }, { text: "🌐 Ganti Domain" }],
      [{ text: "❓ Bantuan" }]
    ],
    resize_keyboard: true,
    is_persistent: true,
  };

  // Keyboard Saat Berada di Halaman Kotak Masuk
  const inboxHubKeyboard = {
    keyboard: [
      [{ text: "🔄 Segarkan Kotak Masuk" }, { text: "🔑 Ambil Kode OTP" }],
      [{ text: "🗑️ Kosongkan Kotak Masuk" }, { text: "⚡ Buat Email Baru" }],
      [{ text: "🏠 Menu Utama" }]
    ],
    resize_keyboard: true,
    is_persistent: true,
  };

  // Keyboard Saat Membaca Detail Pesan
  const messageDetailKeyboard = {
    keyboard: [
      [{ text: "📥 Kotak Masuk" }, { text: "🔑 Ambil Kode OTP" }],
      [{ text: "🏠 Menu Utama" }]
    ],
    resize_keyboard: true,
    is_persistent: true,
  };

  // Keyboard Saat Meminta Input Username Kustom
  const cancelKeyboard = {
    keyboard: [
      [{ text: "⬅️ Batal & Kembali ke Menu" }]
    ],
    resize_keyboard: true,
    is_persistent: true,
  };
  const domainHubKeyboard = (domains: string[]) => {
    const rows: any[] = [];
    for (let i = 0; i < domains.length; i += 2) {
      const row: any[] = [{ text: `@${domains[i]}` }];
      if (i + 1 < domains.length) {
        row.push({ text: `@${domains[i + 1]}` });
      }
      rows.push(row);
    }
    rows.push([{ text: "⚡ Buat Email Baru" }, { text: "🏠 Menu Utama" }]);
    return {
      keyboard: rows,
      resize_keyboard: true,
      is_persistent: true,
    };
  };

  // Keyboard Saat Email Baru Dihasilkan
  const newEmailHubKeyboard = {
    keyboard: [
      [{ text: "📋 Salin Email" }, { text: "📥 Kotak Masuk" }],
      [{ text: "🔄 Acak Baru Lagi" }, { text: "🌐 Ganti Domain" }],
      [{ text: "🏠 Menu Utama" }]
    ],
    resize_keyboard: true,
    is_persistent: true,
  };

  // Keyboard Pilihan Tipe Email Baru (Acak vs Kustom)
  const newTypeKeyboard = {
    keyboard: [
      [{ text: "🎲 Acak" }, { text: "✏️ Kustom Nama" }],
      [{ text: "🏠 Menu Utama" }]
    ],
    resize_keyboard: true,
    is_persistent: true,
  };

  // ── HANDLE CALLBACK QUERY (Inline Buttons) ──────────────────────────────────
  if (update.callback_query) {
    const cb = update.callback_query;
    const data = cb.data || "";
    const cbChatId = cb.message?.chat?.id;
    const cbMsgId = cb.message?.message_id;

    // Answer callback query so spinner stops
    fetch(`https://api.telegram.org/bot${tgToken}/answerCallbackQuery`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ callback_query_id: cb.id }),
    }).catch(() => {});

    // Action: Read message
    if (data.startsWith("read_")) {
      const msgId = data.replace("read_", "");
      const [m] = await db.select().from(messagesTable).where(and(eq(messagesTable.id, msgId), isNull(messagesTable.deletedAt))).limit(1);
      if (m) {
        const rawContent = m.textBody || m.preview || m.htmlBody || "Isi email kosong";
        const cleanContent = getCleanReadableText(rawContent);

        let full = `📖 *Isi Lengkap Email*\n\n`;
        full += `👤 *Dari:* \`${m.fromAddress}\`\n`;
        full += `🎯 *Ke:* \`${m.email}\`\n`;
        full += `📌 *Subjek:* *${m.subject}*\n\n`;
        full += `*Pesan:*\n${cleanContent.slice(0, 3500)}`;

        await sendTg(cbChatId, full, messageDetailKeyboard);
      }
      return;
    }

    // Action: Back to Inbox List
    if (data === "menu_inbox") {
      const [u] = await db.select().from(usersTable).where(eq(usersTable.telegramChatId, String(cbChatId))).limit(1);
      let messages: any[] = [];
      if (u) {
        const userAddrs = await db.select({ email: emailAddressesTable.email }).from(emailAddressesTable).where(eq(emailAddressesTable.userId, u.id));
        const emailList = userAddrs.map(a => a.email);
        if (emailList.length > 0) {
          messages = await db.select().from(messagesTable).where(and(inArray(messagesTable.email, emailList), isNull(messagesTable.deletedAt))).orderBy(desc(messagesTable.receivedAt)).limit(5);
        }
      }
      if (messages.length === 0) {
        messages = await db.select().from(messagesTable).where(isNull(messagesTable.deletedAt)).orderBy(desc(messagesTable.receivedAt)).limit(5);
      }
      if (messages.length === 0) {
        await sendTg(cbChatId, `📭 Kotak masuk masih kosong.`, inboxHubKeyboard);
        return;
      }
      let reply = `📬 *Daftar Pesan Masuk:* (Total: ${messages.length})\n\n`;
      messages.forEach((m, i) => {
        reply += `${i + 1}. *${m.subject}*\n`;
        reply += `   👤 Dari: \`${m.fromAddress.slice(0, 30)}\`\n`;
        reply += `   💬 _${(m.preview || "").slice(0, 80)}_\n\n`;
      });
      reply += `_Gunakan tombol di keyboard bawah untuk melihat detail atau kembali._`;
      await sendTg(cbChatId, reply, inboxHubKeyboard);
      return;
    }

    // Action: Back to Home / Cancel
    if (data === "menu_home" || data === "menu_cancel") {
      if (cbChatId && cbMsgId) {
        await editTg(cbChatId, cbMsgId, `🏠 *Kembali ke Menu Utama TempMail*`, { inline_keyboard: [] });
      }
      await sendTg(cbChatId, `Pilih opsi menu di keyboard bawah untuk mengelola email Anda:`, homeKeyboard);
      return;
    }

    // Action: Delete message
    if (data.startsWith("del_")) {
      const msgId = data.replace("del_", "");
      await db.delete(messagesTable).where(and(eq(messagesTable.id, msgId), isNull(messagesTable.deletedAt)));
      if (cbChatId && cbMsgId) {
        await editTg(cbChatId, cbMsgId, `🗑️ *Pesan email ini telah dihapus.*`);
      }
      return;
    }

    // Action: Ask delete email address (from /emails list)
    if (data.startsWith("emdel_")) {
      const idx = parseInt(data.replace("emdel_", ""), 10);
      const list = emailListCache.get(String(cbChatId)) || [];
      const email = list[idx];
      if (!email || !cbChatId || !cbMsgId) return;
      await editTg(cbChatId, cbMsgId, `\u26a0\uFE0F *Hapus alamat ini?*\n\`${email}\`\n\nSemua pesan di alamat ini ikut terhapus.`, {
        inline_keyboard: [[
          { text: "\u26a0\uFE0F Ya, Hapus", callback_data: `emdyes_${idx}` },
          { text: "Batal", callback_data: "emno" }
        ]]
      });
      return;
    }

    // Action: Confirm delete email address
    if (data.startsWith("emdyes_")) {
      const idx = parseInt(data.replace("emdyes_", ""), 10);
      const list = emailListCache.get(String(cbChatId)) || [];
      const email = list[idx];
      if (email && cbChatId) {
        const [u] = await db.select().from(usersTable).where(eq(usersTable.telegramChatId, String(cbChatId))).limit(1);
        if (u) {
          await db.delete(emailAddressesTable).where(and(eq(emailAddressesTable.email, email), eq(emailAddressesTable.userId, u.id)));
        }
        if (cbMsgId) {
          await editTg(cbChatId, cbMsgId, `🗑\uFE0F *Alamat dihapus:*\n\`${email}\``);
        }
      }
      return;
    }

    // Action: Cancel delete email address
    if (data === "emno") {
      if (cbChatId && cbMsgId) {
        await editTg(cbChatId, cbMsgId, `Batal menghapus. Kirim /emails untuk melihat daftar lagi.`);
      }
      return;
    }

    // Action: Show messages of one address (from /emails)
    if (data.startsWith("embox_")) {
      const idx = parseInt(data.replace("embox_", ""), 10);
      const list = emailListCache.get(String(cbChatId)) || [];
      const email = list[idx];
      if (!email) return;
      const msgs = await db.select().from(messagesTable).where(and(eq(messagesTable.email, email), isNull(messagesTable.deletedAt))).orderBy(desc(messagesTable.receivedAt)).limit(5);
      if (msgs.length === 0) {
        await sendTg(cbChatId, `📭 Belum ada pesan di\n\`${email}\``, inboxHubKeyboard);
        return;
      }
      let reply = `📬 *Pesan di*\n\`${email}\`\n\n`;
      const readInline: any[] = [];
      msgs.forEach((m, i) => {
        const fromShort = m.fromAddress.slice(0, 28);
        reply += `${i + 1}. *${m.subject}*\n`;
        reply += `   👤 \`${fromShort}\`\n`;
        reply += `   💬 _${(m.preview || "").slice(0, 70)}_\n\n`;
        readInline.push([{ text: `📖 Baca #${i + 1}`, callback_data: `read_${m.id}` }]);
      });
      await sendTg(cbChatId, reply, { inline_keyboard: readInline });
      return;
    }

    // Action: Clear all messages confirm
    if (data === "clear_all_confirm") {
      const [u] = await db.select().from(usersTable).where(eq(usersTable.telegramChatId, String(cbChatId))).limit(1);
      if (u) {
        const userAddrs = await db.select({ email: emailAddressesTable.email }).from(emailAddressesTable).where(eq(emailAddressesTable.userId, u.id));
        const emailList = userAddrs.map(a => a.email);
        if (emailList.length > 0) {
          await db.delete(messagesTable).where(inArray(messagesTable.email, emailList));
        }
      }
      if (cbChatId && cbMsgId) {
        await editTg(cbChatId, cbMsgId, `🗑️ *Semua pesan di kotak masuk Anda berhasil dikosongkan.*`);
      }
      await sendTg(cbChatId, `Kotak masuk sekarang bersih.`, inboxHubKeyboard);
      return;
    }

    // Action: Select domain for custom / new email
    if (data.startsWith("setdom_")) {
      const selectedDom = data.replace("setdom_", "").trim().toLowerCase();
      let validDomains = ["bakmi.my.id"];
      if (settingsMap.available_domains) {
        try {
          const parsed = JSON.parse(settingsMap.available_domains);
          if (Array.isArray(parsed) && parsed.length > 0) validDomains = parsed;
        } catch {}
      }
      if (!selectedDom || !validDomains.includes(selectedDom)) {
        if (cbChatId) await sendTg(cbChatId, `Domain tidak valid.`);
        return;
      }
      const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
      let userPart = "";
      for (let i = 0; i < 8; i++) userPart += chars.charAt(Math.floor(Math.random() * chars.length));
      const fullEmail = `${userPart}@${selectedDom}`;
      const now = new Date();
      const expiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

      const [u] = await db.select().from(usersTable).where(eq(usersTable.telegramChatId, String(cbChatId))).limit(1);
      await db.insert(emailAddressesTable).values({
        email: fullEmail,
        username: userPart,
        domain: selectedDom,
        userId: u ? u.id : null,
        createdAt: now,
        expiresAt,
      });

      await sendTg(cbChatId, `🌐 *Email Baru Aktif:*\n\n\`${fullEmail}\`\n\n⏳ Masa Aktif: *30 Hari*`, newEmailHubKeyboard);
      return;
    }

    return;
  }

  // ── HANDLE INLINE QUERY (Pakai bot di chat / grup mana saja) ───────────────
  if (update.inline_query) {
    const iq = update.inline_query;
    const iqId = iq.id;
    const iqFromId = String(iq.from?.id);

    // Find latest email and OTP for this user
    let userEmail = "Belum ada email";
    let latestOtp = "Tidak ada OTP";

    const [u] = await db.select().from(usersTable).where(eq(usersTable.telegramChatId, iqFromId)).limit(1);
    if (u) {
      const [addr] = await db.select().from(emailAddressesTable).where(eq(emailAddressesTable.userId, u.id)).orderBy(desc(emailAddressesTable.createdAt)).limit(1);
      if (addr) userEmail = addr.email;
    }

    const [latestMsg] = await db.select().from(messagesTable).where(isNull(messagesTable.deletedAt)).orderBy(desc(messagesTable.receivedAt)).limit(1);
    if (latestMsg) {
      const match = (latestMsg.subject + " " + latestMsg.preview + " " + (latestMsg.textBody || "")).match(/\b(?:code|kode|otp|pin|verifikasi|token|verification)[^\d]{1,20}(\d{4,8})\b/i)
        || (latestMsg.subject + " " + latestMsg.preview).match(/\b(\d{6})\b/);
      if (match) latestOtp = match[1] || match[0];
    }

    const results = [
      {
        type: "article",
        id: "1",
        title: "📧 Alamat Email TempMail Saya",
        description: userEmail,
        input_message_content: {
          message_text: `📧 Alamat TempMail saya: \`${userEmail}\``,
          parse_mode: "Markdown",
        },
      },
      {
        type: "article",
        id: "2",
        title: `🔑 Kode OTP Terakhir: ${latestOtp}`,
        description: "Salin kode verifikasi sekali pakai",
        input_message_content: {
          message_text: `🔑 Kode OTP TempMail: *${latestOtp}*`,
          parse_mode: "Markdown",
        },
      },
    ];

    fetch(`https://api.telegram.org/bot${tgToken}/answerInlineQuery`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ inline_query_id: iqId, results, cache_time: 2 }),
    }).catch(() => {});
    return;
  }

  // ── HANDLE NORMAL CHAT MESSAGE ─────────────────────────────────────────────
  const msg = update.message;
  if (!msg) return;
  const chatId = msg.chat?.id;
  const text = (msg.text || "").trim();
  if (!chatId || !text) return;
  const strChatId = String(chatId);

  // Command: /help — FAQ & bantuan
  if (text.startsWith("/help") || text === "❓ Bantuan") {
    userFlowState.delete(strChatId);
    const help = `\u2753 *Bantuan TempMail Bot*\n\n` +
      `*Perintah:*\n` +
      `/new \u2014 buat email baru\n` +
      `/inbox \u2014 kotak masuk\n` +
      `/otp \u2014 kode OTP terakhir\n` +
      `/domains \u2014 ganti domain\n` +
      `/emails \u2014 kelola semua email saya\n` +
      `/copy \u2014 salin email aktif\n` +
      `/notif \u2014 nyala/matikan notifikasi\n` +
      `/stats \u2014 statistik penggunaan\n\n` +
      `*Catatan:*\n` +
      `\u2022 Email aktif 30 hari, lalu otomatis dihapus.\n` +
      `\u2022 Tiap email/OTP yang masuk otomatis diteruskan ke chat ini.\n` +
      `\u2022 Jangan pakai untuk akun penting (bank, dsb).`;
    await sendTg(chatId, help, homeKeyboard);
    return;
  }

  // Command: /start atau Menu Utama
  if (text.startsWith("/start") || text.includes("Menu Utama") || text.includes("Batal & Kembali")) {
    userFlowState.delete(strChatId);
    const welcome = `🤖 *TempMail Bot*\n\n` +
      `*Cara pakai:*\n` +
      `1\uFE0F\u20E3 Buat email lewat tombol di bawah\n` +
      `2\uFE0F\u20E3 Pakai alamat itu untuk daftar di situs/aplikasi\n` +
      `3\uFE0F\u20E3 Kode OTP otomatis masuk ke chat ini \u26A1\n\n` +
      `📧 Email aktif 30 hari. Ketik /help untuk bantuan.`;
    await sendTg(chatId, welcome, homeKeyboard);
    return;
  }

  // Command: Buat Email Baru (/new or tombol)
  if (text === "⚡ Buat Email Baru") {
    await sendTg(chatId, `\u26a1 *Buat Email Baru*\n\nPilih tipe email yang diinginkan:`, newTypeKeyboard);
    return;
  }

  // Command: Buat Email Acak (/new atau tombol Acak)
  if (text.startsWith("/new") || text.includes("Acak Baru Lagi") || text === "🎲 Acak") {
    try {
      let domains = ["bakmi.my.id"];
      if (settingsMap.available_domains) {
        try {
          const parsed = JSON.parse(settingsMap.available_domains);
          if (Array.isArray(parsed) && parsed.length > 0) domains = parsed;
        } catch {}
      }
      const dom = domains[0];
      const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
      let userPart = "";
      for (let i = 0; i < 8; i++) userPart += chars.charAt(Math.floor(Math.random() * chars.length));
      const fullEmail = `${userPart}@${dom}`;

      const now = new Date();
      const expiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days

      const [u] = await db.select().from(usersTable).where(eq(usersTable.telegramChatId, strChatId)).limit(1);

      await db.insert(emailAddressesTable).values({
        email: fullEmail,
        username: userPart,
        domain: dom,
        userId: u ? u.id : null,
        createdAt: now,
        expiresAt,
      });

      const reply = `⚡ *Email Sementara Berhasil Dibuat!*\n\n` +
        `📧 Alamat: \`${fullEmail}\`\n` +
        `⏳ Masa Aktif: *30 Hari*\n\n` +
        `_Setiap ada email atau kode OTP yang masuk akan otomatis dikirimkan ke chat ini._`;

      await sendTg(chatId, reply, newEmailHubKeyboard);
    } catch (e: any) {
      await sendTg(chatId, `❌ Gagal membuat email baru: ${e.message}`, homeKeyboard);
    }
    return;
  }

  // Command: Email Saya (/emails) — daftar & kelola semua alamat
  if (text.startsWith("/emails") || text === "📧 Email Saya") {
    const [u] = await db.select().from(usersTable).where(eq(usersTable.telegramChatId, strChatId)).limit(1);
    let addrs: any[] = [];
    if (u) {
      addrs = await db.select().from(emailAddressesTable).where(eq(emailAddressesTable.userId, u.id)).orderBy(desc(emailAddressesTable.createdAt)).limit(20);
    }
    if (addrs.length === 0) {
      await sendTg(chatId, `📧 *Email Saya*\n\nBelum ada alamat email.\nBuat dulu lewat tombol \u26a1 *Buat Email Baru*.`, homeKeyboard);
      return;
    }
    const emails = addrs.map(a => a.email);
    emailListCache.set(strChatId, emails);
    const msgRows = await db.select({ email: messagesTable.email, isRead: messagesTable.isRead }).from(messagesTable).where(and(inArray(messagesTable.email, emails), isNull(messagesTable.deletedAt)));
    const countMap: Record<string, number> = {};
    const unreadMap: Record<string, number> = {};
    for (const r of msgRows) {
      countMap[r.email] = (countMap[r.email] || 0) + 1;
      if (!r.isRead) unreadMap[r.email] = (unreadMap[r.email] || 0) + 1;
    }
    let msg = `📧 *Email Saya* (${addrs.length})\n\n`;
    const kb: any[] = [];
    addrs.forEach((a, i) => {
      const daysLeft = Math.max(0, Math.ceil((new Date(a.expiresAt).getTime() - Date.now()) / 86400000));
      const c = countMap[a.email] || 0;
      const un = unreadMap[a.email] || 0;
      const star = i === 0 ? "\u2b50 " : "";
      const age = daysLeft <= 0 ? "kedaluwarsa" : `${daysLeft} hari lagi`;
      msg += `${i + 1}. ${star}\`${a.email}\`\n`;
      msg += `   \u23f3 ${age} \u2022 📬 ${c} pesan${un > 0 ? ` (${un} baru)` : ""}\n\n`;
      kb.push([
        { text: `📥 #${i + 1} Pesan`, callback_data: `embox_${i}` },
        { text: `🗑\uFE0F #${i + 1} Hapus`, callback_data: `emdel_${i}` }
      ]);
    });
    msg += `_\u2b50 alamat terbaru (dipakai /copy) \u2022 Ketuk alamat untuk menyalin._`;
    await sendTg(chatId, msg, { inline_keyboard: kb });
    return;
  }

  // Command: Notifikasi (/notif) — nyala/matikan forward email ke chat
  if (text.startsWith("/notif") || text === "🔔 Notifikasi") {
    const key = `tg_notif_${strChatId}`;
    const newVal = settingsMap[key] === "off" ? "on" : "off";
    await db.insert(siteSettingsTable).values({ key, value: newVal, updatedAt: new Date() }).onConflictDoUpdate({ target: siteSettingsTable.key, set: { value: newVal, updatedAt: new Date() } });
    settingsMap[key] = newVal;
    await sendTg(chatId, newVal === "off"
      ? `🔕 *Notifikasi dimatikan.*\n\nEmail & OTP baru tidak akan diteruskan ke chat ini.\nKetik /notif lagi untuk menyalakan.`
      : `🔔 *Notifikasi dinyalakan.*\n\nEmail & OTP baru akan otomatis diteruskan ke chat ini.`, homeKeyboard);
    return;
  }

  // Command: Statistik (/stats)
  if (text.startsWith("/stats") || text === "📊 Statistik") {
    const [u] = await db.select().from(usersTable).where(eq(usersTable.telegramChatId, strChatId)).limit(1);
    let addrCount = 0, msgCount = 0, otpCount = 0;
    if (u) {
      const addrs = await db.select({ email: emailAddressesTable.email }).from(emailAddressesTable).where(eq(emailAddressesTable.userId, u.id));
      addrCount = addrs.length;
      if (addrCount > 0) {
        const msgs = await db.select({ subject: messagesTable.subject, preview: messagesTable.preview, textBody: messagesTable.textBody }).from(messagesTable).where(and(inArray(messagesTable.email, addrs.map(a => a.email)), isNull(messagesTable.deletedAt)));
        msgCount = msgs.length;
        const otpRe = /\b(?:code|kode|otp|pin|verifikasi|token|verification)[^\d]{1,20}(\d{4,8})\b/i;
        otpCount = msgs.filter(m => otpRe.test(`${m.subject} ${m.preview} ${m.textBody || ""}`)).length;
      }
    }
    await sendTg(chatId, `📊 *Statistik*\n\n📧 Email dibuat: *${addrCount}*\n📬 Pesan diterima: *${msgCount}*\n🔑 OTP terdeteksi: *${otpCount}*`, homeKeyboard);
    return;
  }

  // Command: Salin Email Aktif
  if (text.startsWith("/copy") || text.includes("Salin Email")) {
    const [u] = await db.select().from(usersTable).where(eq(usersTable.telegramChatId, strChatId)).limit(1);
    let latestEmail = "";
    if (u) {
      const [addr] = await db.select().from(emailAddressesTable).where(eq(emailAddressesTable.userId, u.id)).orderBy(desc(emailAddressesTable.createdAt)).limit(1);
      if (addr) latestEmail = addr.email;
    }
    if (!latestEmail) {
      const [addr] = await db.select().from(emailAddressesTable).orderBy(desc(emailAddressesTable.createdAt)).limit(1);
      if (addr) latestEmail = addr.email;
    }
    if (latestEmail) {
      await sendTg(chatId, `📋 *Alamat Email Aktif:*\n\`${latestEmail}\`\n\n_Tekan tombol di bawah untuk menyalin_`, { inline_keyboard: [[{ text: "📋 Salin Alamat", copy_text: { text: latestEmail } }]] });
    } else {
      await sendTg(chatId, `⚠️ Belum ada email aktif. Silakan buat email baru terlebih dahulu.`, homeKeyboard);
    }
    return;
  }

  // Command: Kustom Email (/custom username atau tombol Kustom Nama)
  if (text.startsWith("/custom") || text.includes("Kustom Nama")) {
    const parts = text.split(/\s+/);
    if (text.includes("Kustom Nama") || parts.length < 2) {
      // Set user state: waiting for custom username input
      userFlowState.set(strChatId, { action: "awaiting_custom_username", timestamp: Date.now() });
      await sendTg(chatId, `✏️ *Buat Email Kustom:*\n\nSilakan langsung *ketik nama email* yang kamu inginkan (misal: \`aldi\` atau \`tokoku\`):\n\n_(Tidak perlu ketik /custom lagi, langsung kirim namanya saja)_`, cancelKeyboard);
      return;
    }
    const targetUser = parts[1].toLowerCase().replace(/[^a-z0-9._-]/g, "").slice(0, 30);
    if (!targetUser) {
      await sendTg(chatId, `❌ Username tidak valid. Gunakan huruf kecil, angka, titik, atau dash.`, homeKeyboard);
      return;
    }

    let domains = ["bakmi.my.id"];
    if (settingsMap.available_domains) {
      try {
        const parsed = JSON.parse(settingsMap.available_domains);
        if (Array.isArray(parsed) && parsed.length > 0) domains = parsed;
      } catch {}
    }
    const dom = domains[0];
    const fullEmail = `${targetUser}@${dom}`;
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    const [u] = await db.select().from(usersTable).where(eq(usersTable.telegramChatId, strChatId)).limit(1);
    await db.insert(emailAddressesTable).values({
      email: fullEmail,
      username: targetUser,
      domain: dom,
      userId: u ? u.id : null,
      createdAt: now,
      expiresAt,
    });

    userFlowState.delete(strChatId);
    await sendTg(chatId, `✨ *Email Kustom Berhasil Dibuat!*\n\n📧 Alamat: \`${fullEmail}\`\n⏳ Masa Aktif: *30 Hari*`, newEmailHubKeyboard);
    return;
  }

  // Handle Free-text Custom Username Input if User is in Flow State
  const pendingState = userFlowState.get(strChatId);
  if (pendingState && pendingState.action === "awaiting_custom_username") {
    // If not a command or cancellation
    if (!text.startsWith("/") && !text.includes("Batal") && !text.includes("Menu Utama")) {
      const targetUser = text.toLowerCase().trim().replace(/[^a-z0-9._-]/g, "").slice(0, 30);
      if (!targetUser || targetUser.length < 2) {
        await sendTg(chatId, `❌ Username minimal 2 karakter (huruf kecil, angka, titik, atau dash). Silakan ketik nama lain:`, cancelKeyboard);
        return;
      }

      let domains = ["bakmi.my.id"];
      if (settingsMap.available_domains) {
        try {
          const parsed = JSON.parse(settingsMap.available_domains);
          if (Array.isArray(parsed) && parsed.length > 0) domains = parsed;
        } catch {}
      }
      const dom = domains[0];
      const fullEmail = `${targetUser}@${dom}`;
      const now = new Date();
      const expiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

      const [u] = await db.select().from(usersTable).where(eq(usersTable.telegramChatId, strChatId)).limit(1);
      await db.insert(emailAddressesTable).values({
        email: fullEmail,
        username: targetUser,
        domain: dom,
        userId: u ? u.id : null,
        createdAt: now,
        expiresAt,
      });

      userFlowState.delete(strChatId);
      await sendTg(chatId, `✨ *Email Kustom Berhasil Dibuat!*\n\n📧 Alamat: \`${fullEmail}\`\n⏳ Masa Aktif: *30 Hari*`, newEmailHubKeyboard);
      return;
    }
  }

  // Command: Buka Versi Web
  if (text.includes("Buka Versi Web")) {
    await sendTg(chatId, `🌐 *Web TempMail:*\nhttps://m.clipku.com/tempmail/\n\n_Buka di browser ponsel untuk tampilan antarmuka visual lengkap, WebView HTML Canva/Google, dan ekspor PDF/EML._`, homeKeyboard);
    return;
  }

  // Command: Kosongkan Kotak Masuk (/clear atau tombol)
  if (text.startsWith("/clear") || text.includes("Kosongkan Kotak Masuk")) {
    const confirmButtons = {
      inline_keyboard: [
        [
          { text: "⚠️ Ya, Kosongkan Semua", callback_data: "clear_all_confirm" },
          { text: "Batal", callback_data: "menu_inbox" }
        ]
      ]
    };
    await sendTg(chatId, `⚠️ *Peringatan:*\nApakah Anda yakin ingin menghapus semua pesan email di kotak masuk Anda?`, confirmButtons);
    return;
  }

  // Command: Ganti Domain
  if (text.startsWith("/domain") || text.includes("Ganti Domain")) {
    let domains = ["bakmi.my.id"];
    if (settingsMap.available_domains) {
      try {
        const parsed = JSON.parse(settingsMap.available_domains);
        if (Array.isArray(parsed) && parsed.length > 0) domains = parsed;
      } catch {}
    }

    await sendTg(chatId, `🌐 *Pilih Domain yang Tersedia:*\n\nKetuk salah satu domain di bawah keyboard untuk membuat email:`, domainHubKeyboard(domains));
    return;
  }

  // Command: Pilih domain dari keyboard ("@..." atau "Domain @...")
  if (text.startsWith("@") || text.startsWith("Domain @")) {
    const selectedDom = text.replace("Domain @", "").replace("@", "").trim();
    const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
    let userPart = "";
    for (let i = 0; i < 8; i++) userPart += chars.charAt(Math.floor(Math.random() * chars.length));
    const fullEmail = `${userPart}@${selectedDom}`;
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    const [u] = await db.select().from(usersTable).where(eq(usersTable.telegramChatId, strChatId)).limit(1);
    await db.insert(emailAddressesTable).values({
      email: fullEmail,
      username: userPart,
      domain: selectedDom,
      userId: u ? u.id : null,
      createdAt: now,
      expiresAt,
    });

    await sendTg(chatId, `🌐 *Email Baru dengan Domain @${selectedDom}:*\n\n\`${fullEmail}\`\n⏳ Masa Aktif: *30 Hari*`, newEmailHubKeyboard);
    return;
  }

  // Command: Ambil OTP (/otp or tombol)
  if (text.startsWith("/otp") || text.includes("Ambil Kode OTP")) {
    try {
      let messages: any[] = [];
      const [u] = await db.select().from(usersTable).where(eq(usersTable.telegramChatId, strChatId)).limit(1);
      if (u) {
        const userAddrs = await db.select({ email: emailAddressesTable.email }).from(emailAddressesTable).where(eq(emailAddressesTable.userId, u.id));
        const addrList = userAddrs.map(a => a.email);
        if (addrList.length > 0) {
          messages = await db.select().from(messagesTable).where(and(inArray(messagesTable.email, addrList), isNull(messagesTable.deletedAt))).orderBy(desc(messagesTable.receivedAt)).limit(5);
        }
      }

      if (messages.length === 0) {
        messages = await db.select().from(messagesTable).where(isNull(messagesTable.deletedAt)).orderBy(desc(messagesTable.receivedAt)).limit(3);
      }

      let foundOtp: { code: string; subject: string; from: string } | null = null;
      for (const m of messages) {
        const match = (m.subject + " " + m.preview + " " + (m.textBody || "")).match(/\b(?:code|kode|otp|pin|verifikasi|token|verification)[^\d]{1,20}(\d{4,8})\b/i)
          || (m.subject + " " + m.preview).match(/\b(\d{6})\b/);
        if (match) {
          foundOtp = { code: match[1] || match[0], subject: m.subject, from: m.fromAddress };
          break;
        }
      }

      if (foundOtp) {
        await sendTg(chatId, `🔑 *KODE OTP TERAKHIR:*\n\n\`${foundOtp.code}\`\n\n📌 *Subjek:* ${foundOtp.subject}\n👤 *Dari:* \`${foundOtp.from}\`\n\n_(Ketuk kode di atas untuk menyalin)_`, inboxHubKeyboard);
      } else {
        await sendTg(chatId, `⚠️ Belum ada kode OTP yang terdeteksi di kotak masuk Anda.`, homeKeyboard);
      }
    } catch (e: any) {
      await sendTg(chatId, `❌ Gagal mengambil OTP: ${e.message}`, homeKeyboard);
    }
    return;
  }

  // Command: Kotak Masuk (/inbox or tombol)
  if (text.startsWith("/inbox") || text.includes("Kotak Masuk") || text.includes("Segarkan Kotak Masuk")) {
    try {
      let messages: any[] = [];
      const [u] = await db.select().from(usersTable).where(eq(usersTable.telegramChatId, strChatId)).limit(1);
      if (u) {
        const userAddrs = await db.select({ email: emailAddressesTable.email }).from(emailAddressesTable).where(eq(emailAddressesTable.userId, u.id));
        const addrList = userAddrs.map(a => a.email);
        if (addrList.length > 0) {
          messages = await db.select().from(messagesTable).where(and(inArray(messagesTable.email, addrList), isNull(messagesTable.deletedAt))).orderBy(desc(messagesTable.receivedAt)).limit(5);
        }
      }

      if (messages.length === 0) {
        messages = await db.select().from(messagesTable).where(isNull(messagesTable.deletedAt)).orderBy(desc(messagesTable.receivedAt)).limit(5);
      }

      if (messages.length === 0) {
        await sendTg(chatId, `📭 Kotak masuk masih kosong. Belum ada email yang diterima.`, inboxHubKeyboard);
        return;
      }
      let reply = `📬 *Daftar Pesan Masuk:* (Total: ${messages.length})\n\n`;
      const readInline: any[] = [];
      messages.forEach((m, i) => {
        reply += `${i + 1}. *${m.subject}*\n`;
        reply += `   👤 Dari: \`${m.fromAddress.slice(0, 30)}\`\n`;
        reply += `   💬 _${(m.preview || "").slice(0, 80)}_\n\n`;

        const fromShort = m.fromAddress.split("<")[0].replace(/['"]/g, "").trim().slice(0, 15);
        readInline.push([{ text: `📖 Baca #${i + 1} (${fromShort})`, callback_data: `read_${m.id}` }]);
      });
      reply += `_Klik tombol baca di atas atau gunakan menu keyboard di bawah:_`;

      await sendTg(chatId, reply, {
        inline_keyboard: readInline
      });
      // Also update bottom persistent keyboard to Inbox Hub
      await sendTg(chatId, `👇 Menu navigasi kotak masuk aktif:`, inboxHubKeyboard);
    } catch (e: any) {
      await sendTg(chatId, `❌ Gagal membaca kotak masuk: ${e.message}`, homeKeyboard);
    }
    return;
  }
});

export { router as webhookRouter };
