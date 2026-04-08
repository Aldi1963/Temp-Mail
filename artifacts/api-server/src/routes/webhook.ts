import { Router } from "express";
import { randomUUID } from "crypto";
import { db } from "@workspace/db";
import {
  emailAddressesTable,
  messagesTable,
  siteSettingsTable,
} from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAdmin } from "../lib/auth.js";
import { triggerWebhooksForEmail } from "./developer.js";

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

router.post("/inbound-email", async (req, res) => {
  const authHeader = req.headers["x-webhook-secret"] as string | undefined;

  if (!authHeader) {
    res.status(401).json({ error: "Unauthorized", message: "Header X-Webhook-Secret wajib ada." });
    return;
  }

  const expectedSecret = await getInboundSecret();
  if (authHeader !== expectedSecret) {
    res.status(403).json({ error: "Forbidden", message: "Secret tidak valid." });
    return;
  }

  const { to, from: fromAddr, subject, textBody, htmlBody } = req.body ?? {};

  if (!to || !fromAddr) {
    res.status(400).json({ error: "Bad request", message: "Field 'to' dan 'from' wajib diisi." });
    return;
  }

  const toEmail = String(to).toLowerCase().trim();
  const fromEmail = String(fromAddr).trim();

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

  const subjectStr = subject ? String(subject).trim() : "(no subject)";
  const textStr = textBody ? String(textBody) : null;
  const htmlStr = htmlBody ? String(htmlBody) : null;

  const preview = (textStr || htmlStr || "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 200);

  const messageId = randomUUID();

  await db.insert(messagesTable).values({
    id: messageId,
    email: toEmail,
    fromAddress: fromEmail,
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
    from: fromEmail,
    to: toEmail,
    subject: subjectStr,
    preview,
    receivedAt: now.toISOString(),
  });

  res.json({ success: true, messageId, to: toEmail });
});

export { router as webhookRouter };
