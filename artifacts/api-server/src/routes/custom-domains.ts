import { Router } from "express";
import { randomBytes, timingSafeEqual } from "crypto";
import { promises as dns } from "dns";
import { db } from "@workspace/db";
import { customDomainsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { requireAuthOrApiKey } from "../lib/auth.js";
import { getActiveDomains } from "./email.js";

const router = Router();
router.use(requireAuthOrApiKey);

const WEBHOOK_URL = process.env.PUBLIC_WEBHOOK_URL ?? "https://m.clipku.com/api/webhook/inbound-email";
const DOMAIN_RE = /^(?!-)[a-z0-9-]{1,63}(?<!-)(\.(?!-)[a-z0-9-]{1,63}(?<!-))*$/;
const VERIFY_PREFIX = "_tempmail-verify";
const DNS_TIMEOUT_MS = 8000;
const MAX_DOMAINS_PER_USER = 5;

function getUserId(req: any): number {
  return req.session.userId ?? req.apiKeyUserId!;
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, rej) => setTimeout(() => rej(new Error("DNS timeout")), ms)),
  ]);
}

function normalizeDomain(input: unknown): string | null {
  if (typeof input !== "string") return null;
  const d = input.toLowerCase().trim().replace(/\.$/, "");
  if (d.length > 253 || !d.includes(".") || !DOMAIN_RE.test(d)) return null;
  const tld = d.split(".").pop()!;
  if (!/^[a-z]{2,}$/.test(tld)) return null;
  return d;
}

async function checkTxt(domain: string, token: string): Promise<boolean> {
  try {
    const recs = await withTimeout(dns.resolveTxt(VERIFY_PREFIX + "." + domain), DNS_TIMEOUT_MS);
    return recs.flat().some((t) => t.trim() === token);
  } catch {
    return false;
  }
}

async function checkMx(domain: string): Promise<boolean> {
  try {
    const recs = await withTimeout(dns.resolveMx(domain), DNS_TIMEOUT_MS);
    return recs.some((r) => r.exchange.toLowerCase().endsWith("mx.cloudflare.net"));
  } catch {
    return false;
  }
}

export function buildWorkerScript(webhookSecret: string): string {
  return '/**\n' +
    ' * TempMail Email Worker (custom domain)\n' +
    ' * Script ini sudah terisi otomatis untuk domain Anda.\n' +
    ' *\n' +
    ' * Cara pasang:\n' +
    ' * 1. Cloudflare Dashboard -> Workers & Pages -> Create Worker -> Deploy\n' +
    ' * 2. Edit code -> hapus semua -> tempel script ini -> Deploy\n' +
    ' * 3. Email -> Email Routing -> pilih domain Anda -> Routing rules\n' +
    ' * 4. Tambah rule: Custom address "*" (catch-all) atau alamat tertentu,\n' +
    ' *    action "Send to Worker" -> pilih worker ini\n' +
    ' */\n' +
    'const WEBHOOK_URL = ' + JSON.stringify(WEBHOOK_URL) + ';\n' +
    'const WEBHOOK_SECRET = ' + JSON.stringify(webhookSecret) + ';\n' +
    '\n' +
    'export default {\n' +
    '  async email(message, env, ctx) {\n' +
    '    let rawBody = "";\n' +
    '    try {\n' +
    '      rawBody = await new Response(message.raw).text();\n' +
    '    } catch (err) {\n' +
    '      console.error("Gagal baca email:", err);\n' +
    '      message.setReject("Failed to read email");\n' +
    '      return;\n' +
    '    }\n' +
    '    const payload = {\n' +
    '      to: message.to,\n' +
    '      from: message.from,\n' +
    '      subject: (message.headers.get("subject") || "(tanpa subjek)"),\n' +
    '      textBody: rawBody,\n' +
    '      htmlBody: null,\n' +
    '    };\n' +
    '    try {\n' +
    '      const resp = await fetch(WEBHOOK_URL, {\n' +
    '        method: "POST",\n' +
    '        headers: { "Content-Type": "application/json", "X-Webhook-Secret": WEBHOOK_SECRET },\n' +
    '        body: JSON.stringify(payload),\n' +
    '      });\n' +
    '      if (!resp.ok) {\n' +
    '        const body = await resp.text();\n' +
    '        console.error("Webhook gagal [" + resp.status + "]:", body);\n' +
    '        if (resp.status === 404 || resp.status === 410) message.setReject("Address not found or expired");\n' +
    '        return;\n' +
    '      }\n' +
    '      console.log("Terkirim ke TempMail");\n' +
    '    } catch (err) {\n' +
    '      console.error("Gagal kirim webhook:", err);\n' +
    '      message.setReject("Failed to deliver email");\n' +
    '    }\n' +
    '  },\n' +
    '};\n';
}

function publicRow(r: any) {
  return {
    id: r.id,
    domain: r.domain,
    status: r.status,
    verificationToken: r.verificationToken,
    webhookSecret: r.webhookSecret,
    verifiedAt: r.verifiedAt,
    createdAt: r.createdAt,
  };
}

// Daftar domain kustom milik user
router.get("/", async (req, res) => {
  const userId = getUserId(req);
  const rows = await db.select().from(customDomainsTable).where(eq(customDomainsTable.userId, userId));
  res.json({ domains: rows.map(publicRow), maxPerUser: MAX_DOMAINS_PER_USER, webhookUrl: WEBHOOK_URL });
});

// Tambah domain
router.post("/", async (req, res) => {
  const userId = getUserId(req);
  const domain = normalizeDomain(req.body?.domain);
  if (!domain) {
    res.status(400).json({ error: "Bad request", message: "Format domain tidak valid." });
    return;
  }
  const global = await getActiveDomains();
  if (global.includes(domain)) {
    res.status(409).json({ error: "Conflict", message: "Domain ini adalah domain publik layanan." });
    return;
  }
  const existing = await db.select().from(customDomainsTable).where(eq(customDomainsTable.domain, domain)).limit(1);
  if (existing.length > 0) {
    res.status(409).json({ error: "Conflict", message: "Domain sudah didaftarkan." });
    return;
  }
  const mine = await db.select().from(customDomainsTable).where(eq(customDomainsTable.userId, userId));
  if (mine.length >= MAX_DOMAINS_PER_USER) {
    res.status(429).json({ error: "Limit", message: "Maksimal " + MAX_DOMAINS_PER_USER + " domain per akun." });
    return;
  }
  const verificationToken = randomBytes(24).toString("hex");
  const webhookSecret = randomBytes(32).toString("hex");
  const [row] = await db.insert(customDomainsTable).values({
    userId, domain, status: "pending", verificationToken, webhookSecret,
  }).returning();
  res.status(201).json({ domain: publicRow(row), webhookUrl: WEBHOOK_URL });
});

// Verifikasi kepemilikan via TXT
router.post("/:id/verify", async (req, res) => {
  const userId = getUserId(req);
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    res.status(400).json({ error: "Bad request", message: "ID tidak valid." });
    return;
  }
  const [row] = await db.select().from(customDomainsTable)
    .where(and(eq(customDomainsTable.id, id), eq(customDomainsTable.userId, userId))).limit(1);
  if (!row) {
    res.status(404).json({ error: "Not Found", message: "Domain tidak ditemukan." });
    return;
  }
  const [txtOk, mxOk] = await Promise.all([checkTxt(row.domain, row.verificationToken), checkMx(row.domain)]);
  let status = row.status;
  if (txtOk && status !== "active") {
    await db.update(customDomainsTable).set({ status: "active", verifiedAt: new Date() }).where(eq(customDomainsTable.id, id));
    status = "active";
  }
  res.json({ txtOk, mxOk, status, message: txtOk ? "Domain terverifikasi dan aktif." : "TXT verifikasi belum ditemukan." });
});

// Hapus domain
router.delete("/:id", async (req, res) => {
  const userId = getUserId(req);
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    res.status(400).json({ error: "Bad request", message: "ID tidak valid." });
    return;
  }
  const [row] = await db.select().from(customDomainsTable)
    .where(and(eq(customDomainsTable.id, id), eq(customDomainsTable.userId, userId))).limit(1);
  if (!row) {
    res.status(404).json({ error: "Not Found", message: "Domain tidak ditemukan." });
    return;
  }
  await db.delete(customDomainsTable).where(eq(customDomainsTable.id, id));
  res.json({ success: true });
});

// Script worker siap tempel
router.get("/:id/worker-script", async (req, res) => {
  const userId = getUserId(req);
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    res.status(400).json({ error: "Bad request", message: "ID tidak valid." });
    return;
  }
  const [row] = await db.select().from(customDomainsTable)
    .where(and(eq(customDomainsTable.id, id), eq(customDomainsTable.userId, userId))).limit(1);
  if (!row) {
    res.status(404).json({ error: "Not Found", message: "Domain tidak ditemukan." });
    return;
  }
  res.json({ domain: row.domain, webhookUrl: WEBHOOK_URL, script: buildWorkerScript(row.webhookSecret) });
});

export function secretMatches(provided: string | undefined, expected: string): boolean {
  if (!provided) return false;
  const a = Buffer.from(provided, "utf8");
  const b = Buffer.from(expected, "utf8");
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function findCustomDomainBySecret(authHeader: string | undefined, toEmail: string) {
  if (!authHeader) return null;
  const at = toEmail.lastIndexOf("@");
  if (at === -1) return null;
  const dom = toEmail.slice(at + 1).toLowerCase();
  const rows = await db.select().from(customDomainsTable)
    .where(and(eq(customDomainsTable.domain, dom), eq(customDomainsTable.status, "active"))).limit(1);
  if (rows.length === 0) return null;
  return secretMatches(authHeader, rows[0].webhookSecret) ? rows[0] : null;
}

export const customDomainsRouter = router;
