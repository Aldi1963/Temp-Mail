import { Request, Response, NextFunction } from "express";
import { db } from "@workspace/db";
import { usersTable, apiKeysTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";

declare module "express-session" {
  interface SessionData {
    userId: number;
    userRole: string;
  }
}

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.session?.userId) {
    res.status(401).json({ error: "Unauthorized", message: "Silakan login terlebih dahulu." });
    return;
  }
  next();
}

export async function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.session?.userId) {
    res.status(401).json({ error: "Unauthorized", message: "Silakan login terlebih dahulu." });
    return;
  }
  if (req.session.userRole !== "admin") {
    res.status(403).json({ error: "Forbidden", message: "Akses admin diperlukan." });
    return;
  }
  next();
}

export async function getCurrentUser(req: Request) {
  if (!req.session?.userId) return null;
  const results = await db.select().from(usersTable).where(eq(usersTable.id, req.session.userId)).limit(1);
  return results[0] ?? null;
}

export async function requireAuthOrApiKey(req: Request, res: Response, next: NextFunction) {
  if (req.session?.userId) return next();

  const apiKey = req.headers["x-api-key"] as string | undefined;
  if (!apiKey || !apiKey.startsWith("tmk_")) {
    res.status(401).json({ error: "Unauthorized", message: "Silakan login atau sertakan X-API-Key." });
    return;
  }

  const prefix = apiKey.substring(0, 12);
  const candidates = await db
    .select()
    .from(apiKeysTable)
    .where(eq(apiKeysTable.keyPrefix, prefix));

  for (const key of candidates) {
    if (key.expiresAt && key.expiresAt < new Date()) continue;
    const match = await bcrypt.compare(apiKey, key.keyHash);
    if (match) {
      req.session.userId = key.userId;
      await db.update(apiKeysTable).set({ lastUsedAt: new Date() }).where(eq(apiKeysTable.id, key.id));
      return next();
    }
  }

  res.status(401).json({ error: "Unauthorized", message: "API key tidak valid." });
}
