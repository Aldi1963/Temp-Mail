import { Router } from "express";
import { db } from "@workspace/db";
import { apiKeysTable, webhooksTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { randomBytes, createHmac } from "crypto";
import bcrypt from "bcryptjs";
import { requireAuth } from "../lib/auth.js";
import { validateWebhookUrl } from "../lib/ssrf-guard.js";

const router = Router();
router.use(requireAuth);

// ─── API Keys ────────────────────────────────────────────────────────────────

router.get("/keys", async (req, res) => {
  const userId = req.session.userId!;
  const keys = await db
    .select({
      id: apiKeysTable.id,
      name: apiKeysTable.name,
      keyPrefix: apiKeysTable.keyPrefix,
      lastUsedAt: apiKeysTable.lastUsedAt,
      expiresAt: apiKeysTable.expiresAt,
      createdAt: apiKeysTable.createdAt,
    })
    .from(apiKeysTable)
    .where(eq(apiKeysTable.userId, userId));
  res.json({ keys });
});

router.post("/keys", async (req, res) => {
  const userId = req.session.userId!;
  const { name } = req.body ?? {};

  if (!name || typeof name !== "string" || name.trim().length === 0) {
    res.status(400).json({ error: "Bad request", message: "Nama API key wajib diisi." });
    return;
  }

  const existing = await db
    .select({ id: apiKeysTable.id })
    .from(apiKeysTable)
    .where(eq(apiKeysTable.userId, userId));
  if (existing.length >= 1) {
    res.status(400).json({ error: "Bad request", message: "Hanya boleh 1 API key per akun. Hapus yang ada sebelum membuat yang baru." });
    return;
  }

  const rawKey = `tmk_${randomBytes(32).toString("hex")}`;
  const keyPrefix = rawKey.substring(0, 12);
  const keyHash = await bcrypt.hash(rawKey, 10);

  const [created] = await db
    .insert(apiKeysTable)
    .values({ userId, name: name.trim(), keyPrefix, keyHash })
    .returning();

  res.json({
    key: rawKey,
    id: created.id,
    name: created.name,
    keyPrefix: created.keyPrefix,
    createdAt: created.createdAt,
  });
});

router.post("/keys/:id/regenerate", async (req, res) => {
  const userId = req.session.userId!;
  const id = parseInt(req.params.id, 10);
  const { name } = req.body ?? {};

  const existing = await db
    .select()
    .from(apiKeysTable)
    .where(and(eq(apiKeysTable.id, id), eq(apiKeysTable.userId, userId)))
    .limit(1);

  if (existing.length === 0) {
    res.status(404).json({ error: "Not found", message: "API key tidak ditemukan." });
    return;
  }

  const keyName = name?.trim() || existing[0].name;
  const rawKey = `tmk_${randomBytes(32).toString("hex")}`;
  const keyPrefix = rawKey.substring(0, 12);
  const keyHash = await bcrypt.hash(rawKey, 10);

  await db.delete(apiKeysTable).where(eq(apiKeysTable.id, id));

  const [created] = await db
    .insert(apiKeysTable)
    .values({ userId, name: keyName, keyPrefix, keyHash })
    .returning();

  res.json({
    key: rawKey,
    id: created.id,
    name: created.name,
    keyPrefix: created.keyPrefix,
    createdAt: created.createdAt,
  });
});

router.patch("/keys/:id", async (req, res) => {
  const userId = req.session.userId!;
  const id = parseInt(req.params.id, 10);
  const { name } = req.body ?? {};

  if (!name || typeof name !== "string" || name.trim().length === 0) {
    res.status(400).json({ error: "Bad request", message: "Nama API key wajib diisi." });
    return;
  }

  const updated = await db
    .update(apiKeysTable)
    .set({ name: name.trim() })
    .where(and(eq(apiKeysTable.id, id), eq(apiKeysTable.userId, userId)))
    .returning({ id: apiKeysTable.id, name: apiKeysTable.name });

  if (updated.length === 0) {
    res.status(404).json({ error: "Not found", message: "API key tidak ditemukan." });
    return;
  }
  res.json({ success: true, id: updated[0].id, name: updated[0].name });
});

router.delete("/keys/:id", async (req, res) => {
  const userId = req.session.userId!;
  const id = parseInt(req.params.id, 10);

  const deleted = await db
    .delete(apiKeysTable)
    .where(and(eq(apiKeysTable.id, id), eq(apiKeysTable.userId, userId)))
    .returning();

  if (deleted.length === 0) {
    res.status(404).json({ error: "Not found", message: "API key tidak ditemukan." });
    return;
  }
  res.json({ success: true });
});

// ─── Webhooks ────────────────────────────────────────────────────────────────

router.get("/webhooks", async (req, res) => {
  const userId = req.session.userId!;
  const hooks = await db
    .select()
    .from(webhooksTable)
    .where(eq(webhooksTable.userId, userId));

  res.json({
    webhooks: hooks.map((h) => ({
      id: h.id,
      url: h.url,
      events: JSON.parse(h.events),
      active: h.active,
      lastTriggeredAt: h.lastTriggeredAt,
      failCount: h.failCount,
      createdAt: h.createdAt,
    })),
  });
});

router.post("/webhooks", async (req, res) => {
  const userId = req.session.userId!;
  const { url, events } = req.body ?? {};

  if (!url || typeof url !== "string") {
    res.status(400).json({ error: "Bad request", message: "URL webhook wajib diisi." });
    return;
  }

  try {
    new URL(url);
  } catch {
    res.status(400).json({ error: "Bad request", message: "URL tidak valid." });
    return;
  }

  // [SECURITY] Anti-SSRF: tolak URL ke IP privat/loopback/link-local/metadata cloud.
  // Hanya http/https ke host publik yang diizinkan.
  const ssrfError = await validateWebhookUrl(url);
  if (ssrfError) {
    res.status(400).json({ error: "Bad request", message: `URL webhook ditolak: ${ssrfError}` });
    return;
  }

  const existing = await db
    .select({ id: webhooksTable.id })
    .from(webhooksTable)
    .where(eq(webhooksTable.userId, userId));
  if (existing.length >= 1) {
    res.status(400).json({ error: "Bad request", message: "Hanya boleh 1 webhook per akun. Hapus yang ada sebelum menambah yang baru." });
    return;
  }

  const secret = randomBytes(32).toString("hex");
  const validEvents = ["new_message", "inbox_expired"];
  const eventsArr = Array.isArray(events)
    ? events.filter((e: string) => validEvents.includes(e))
    : ["new_message"];
  const finalEvents = eventsArr.length > 0 ? eventsArr : ["new_message"];

  const [created] = await db
    .insert(webhooksTable)
    .values({ userId, url, events: JSON.stringify(finalEvents), secret })
    .returning();

  res.json({
    id: created.id,
    url: created.url,
    events: finalEvents,
    secret,
    active: created.active,
    createdAt: created.createdAt,
  });
});

router.post("/webhooks/:id/rotate-secret", async (req, res) => {
  const userId = req.session.userId!;
  const id = parseInt(req.params.id, 10);

  const hooks = await db
    .select()
    .from(webhooksTable)
    .where(and(eq(webhooksTable.id, id), eq(webhooksTable.userId, userId)))
    .limit(1);

  if (hooks.length === 0) {
    res.status(404).json({ error: "Not found", message: "Webhook tidak ditemukan." });
    return;
  }

  const newSecret = randomBytes(32).toString("hex");

  await db
    .update(webhooksTable)
    .set({ secret: newSecret })
    .where(eq(webhooksTable.id, id));

  res.json({ success: true, secret: newSecret });
});

router.delete("/webhooks/:id", async (req, res) => {
  const userId = req.session.userId!;
  const id = parseInt(req.params.id, 10);

  const deleted = await db
    .delete(webhooksTable)
    .where(and(eq(webhooksTable.id, id), eq(webhooksTable.userId, userId)))
    .returning();

  if (deleted.length === 0) {
    res.status(404).json({ error: "Not found", message: "Webhook tidak ditemukan." });
    return;
  }
  res.json({ success: true });
});

router.patch("/webhooks/:id", async (req, res) => {
  const userId = req.session.userId!;
  const id = parseInt(req.params.id, 10);
  const { active } = req.body ?? {};

  await db
    .update(webhooksTable)
    .set({ active: Boolean(active) })
    .where(and(eq(webhooksTable.id, id), eq(webhooksTable.userId, userId)));

  res.json({ success: true });
});

router.post("/webhooks/:id/test", async (req, res) => {
  const userId = req.session.userId!;
  const id = parseInt(req.params.id, 10);

  const hooks = await db
    .select()
    .from(webhooksTable)
    .where(and(eq(webhooksTable.id, id), eq(webhooksTable.userId, userId)))
    .limit(1);

  if (hooks.length === 0) {
    res.status(404).json({ error: "Not found", message: "Webhook tidak ditemukan." });
    return;
  }

  const hook = hooks[0];
  const payload = {
    event: "test",
    timestamp: new Date().toISOString(),
    data: { message: "Ini adalah test webhook dari TempMail." },
  };

  const sig = createHmac("sha256", hook.secret)
    .update(JSON.stringify(payload))
    .digest("hex");

  try {
    const resp = await fetch(hook.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-TempMail-Signature": sig,
        "X-TempMail-Event": "test",
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(10000),
    });
    res.json({ success: resp.ok, statusCode: resp.status });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    res.json({ success: false, error: message });
  }
});

export { router as developerRouter };
export { triggerWebhooksForEmail };

async function triggerWebhooksForEmail(
  emailAddress: string,
  event: string,
  data: Record<string, unknown>
): Promise<void> {
  const emailParts = emailAddress.split("@");
  if (emailParts.length !== 2) return;

  const { emailAddressesTable } = await import("@workspace/db");
  const addr = await db
    .select({ userId: emailAddressesTable.userId })
    .from(emailAddressesTable)
    .where(eq(emailAddressesTable.email, emailAddress))
    .limit(1);

  if (addr.length === 0 || !addr[0].userId) return;

  const userId = addr[0].userId;
  const hooks = await db
    .select()
    .from(webhooksTable)
    .where(and(eq(webhooksTable.userId, userId), eq(webhooksTable.active, true)));

  const now = new Date();

  for (const hook of hooks) {
    let events: string[] = [];
    try {
      events = JSON.parse(hook.events);
    } catch {
      events = ["new_message"];
    }
    if (!events.includes(event)) continue;

    // [SECURITY] Validasi ulang URL sebelum POST (anti DNS-rebinding):
    // hostname bisa berubah resolve ke IP internal setelah registrasi.
    const triggerCheck = await validateWebhookUrl(hook.url);
    if (triggerCheck) {
      await db
        .update(webhooksTable)
        .set({ failCount: hook.failCount + 1 })
        .where(eq(webhooksTable.id, hook.id));
      continue;
    }

    const payload = { event, timestamp: now.toISOString(), data };
    const sig = createHmac("sha256", hook.secret)
      .update(JSON.stringify(payload))
      .digest("hex");

    fetch(hook.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-TempMail-Signature": sig,
        "X-TempMail-Event": event,
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(10000),
    })
      .then(async () => {
        await db
          .update(webhooksTable)
          .set({ lastTriggeredAt: now, failCount: 0 })
          .where(eq(webhooksTable.id, hook.id));
      })
      .catch(async () => {
        await db
          .update(webhooksTable)
          .set({ failCount: hook.failCount + 1 })
          .where(eq(webhooksTable.id, hook.id));
      });
  }
}
