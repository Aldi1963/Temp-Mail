import { Request, Response, NextFunction } from "express";
import { db } from "@workspace/db";
import { usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";

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
