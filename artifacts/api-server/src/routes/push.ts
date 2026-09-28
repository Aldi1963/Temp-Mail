import { Router } from "express";
import { db } from "@workspace/db";
import { pushTokensTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router = Router();

// Registrasi token push device (mis. FCM registration token dari aplikasi
// Android). Idempoten: token yang sama di-upsert.
router.post("/register", async (req, res) => {
  const body = (req.body ?? {}) as { token?: unknown; email?: unknown; platform?: unknown };
  const token = typeof body.token === "string" ? body.token.trim() : "";
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const platform =
    typeof body.platform === "string" && body.platform.trim()
      ? body.platform.trim().slice(0, 32)
      : "android";

  if (!token || token.length > 512) {
    res.status(400).json({ error: "Bad request", message: "token is required" });
    return;
  }
  if (email && !email.includes("@")) {
    res.status(400).json({ error: "Bad request", message: "email tidak valid" });
    return;
  }

  // Aplikasi Android memakai native token auth sehingga session terisi;
  // simpan userId bila ada untuk targeting di masa depan.
  const sessionUserId =
    (req as { session?: { userId?: number } }).session?.userId ?? null;

  await db
    .insert(pushTokensTable)
    .values({ token, email: email || null, userId: sessionUserId, platform })
    .onConflictDoUpdate({
      target: pushTokensTable.token,
      set: { email: email || null, userId: sessionUserId, platform },
    });

  res.json({ success: true });
});

// Hapus token push (mis. saat user logout / uninstall).
router.delete("/unregister", async (req, res) => {
  const raw =
    typeof req.query.token === "string"
      ? req.query.token
      : ((req.body as { token?: unknown } | undefined)?.token ?? "");
  const token = String(raw).trim();
  if (!token) {
    res.status(400).json({ error: "Bad request", message: "token is required" });
    return;
  }

  await db.delete(pushTokensTable).where(eq(pushTokensTable.token, token));
  res.json({ success: true });
});

export const pushRouter = router;
