import { Router } from "express";
import { db } from "@workspace/db";
import { emailAddressesTable, messagesTable } from "@workspace/db";
import { eq, desc, count } from "drizzle-orm";
import { requireAuthOrApiKey } from "../lib/auth.js";

const router = Router();

router.use(requireAuthOrApiKey);

router.get("/emails", async (req, res) => {
  const userId = req.session.userId!;
  const emails = await db
    .select()
    .from(emailAddressesTable)
    .where(eq(emailAddressesTable.userId, userId))
    .orderBy(desc(emailAddressesTable.createdAt));

  const result = await Promise.all(
    emails.map(async (e) => {
      const [msgCount] = await db.select({ count: count() }).from(messagesTable).where(eq(messagesTable.email, e.email));
      return {
        email: e.email,
        domain: e.domain,
        createdAt: e.createdAt,
        expiresAt: e.expiresAt,
        isExpired: e.expiresAt < new Date(),
        messageCount: Number(msgCount.count),
      };
    })
  );

  res.json({ emails: result });
});

router.get("/stats", async (req, res) => {
  const userId = req.session.userId!;
  const emails = await db.select().from(emailAddressesTable).where(eq(emailAddressesTable.userId, userId));

  let totalMessages = 0;
  for (const e of emails) {
    const [row] = await db.select({ count: count() }).from(messagesTable).where(eq(messagesTable.email, e.email));
    totalMessages += Number(row.count);
  }

  res.json({
    totalEmails: emails.length,
    totalMessages,
    activeEmails: emails.filter((e) => e.expiresAt > new Date()).length,
  });
});

export { router as userRouter };
