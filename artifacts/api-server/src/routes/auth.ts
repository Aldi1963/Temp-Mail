import { Router } from "express";
import { db } from "@workspace/db";
import { usersTable } from "@workspace/db";
import { eq, count } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { requireAuth } from "../lib/auth.js";

const router = Router();

router.post("/register", async (req, res) => {
  const { email, password } = req.body ?? {};

  if (!email || !password) {
    res.status(400).json({ error: "Bad request", message: "Email dan password wajib diisi." });
    return;
  }

  if (typeof password !== "string" || password.length < 6) {
    res.status(400).json({ error: "Bad request", message: "Password minimal 6 karakter." });
    return;
  }

  const existing = await db.select().from(usersTable).where(eq(usersTable.email, email.toLowerCase())).limit(1);
  if (existing.length > 0) {
    res.status(409).json({ error: "Conflict", message: "Email sudah terdaftar." });
    return;
  }

  const [{ total }] = await db.select({ total: count() }).from(usersTable);
  const isFirstUser = Number(total) === 0;

  const passwordHash = await bcrypt.hash(password, 10);
  const [user] = await db.insert(usersTable).values({
    email: email.toLowerCase().trim(),
    passwordHash,
    role: isFirstUser ? "admin" : "user",
  }).returning();

  req.session.userId = user.id;
  req.session.userRole = user.role;

  res.json({ id: user.id, email: user.email, role: user.role, createdAt: user.createdAt });
});

router.post("/login", async (req, res) => {
  const { email, password } = req.body ?? {};

  if (!email || !password) {
    res.status(400).json({ error: "Bad request", message: "Email dan password wajib diisi." });
    return;
  }

  const results = await db.select().from(usersTable).where(eq(usersTable.email, email.toLowerCase().trim())).limit(1);
  if (results.length === 0) {
    res.status(401).json({ error: "Unauthorized", message: "Email atau password salah." });
    return;
  }

  const user = results[0];
  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    res.status(401).json({ error: "Unauthorized", message: "Email atau password salah." });
    return;
  }

  req.session.userId = user.id;
  req.session.userRole = user.role;

  res.json({ id: user.id, email: user.email, role: user.role, createdAt: user.createdAt });
});

router.post("/logout", (req, res) => {
  req.session.destroy(() => {
    res.clearCookie("tempmail.sid");
    res.json({ success: true, message: "Berhasil logout." });
  });
});

router.get("/me", requireAuth, async (req, res) => {
  const results = await db.select().from(usersTable).where(eq(usersTable.id, req.session.userId!)).limit(1);
  if (results.length === 0) {
    req.session.destroy(() => {});
    res.status(401).json({ error: "Unauthorized", message: "Sesi tidak valid." });
    return;
  }
  const user = results[0];
  res.json({ id: user.id, email: user.email, role: user.role, createdAt: user.createdAt });
});

export { router as authRouter };
