import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { siteSettingsTable } from "@workspace/db";
import { inArray } from "drizzle-orm";

const router: IRouter = Router();

const PUBLIC_BRANDING_KEYS = [
  "site_name",
  "site_description",
  "site_logo_url",
  "site_favicon_url",
  "meta_title",
  "meta_keywords",
  "footer_text",
];

router.get("/branding", async (_req, res) => {
  try {
    const rows = await db
      .select()
      .from(siteSettingsTable)
      .where(inArray(siteSettingsTable.key, PUBLIC_BRANDING_KEYS));
    const branding: Record<string, string> = {};
    for (const row of rows) {
      branding[row.key] = row.value;
    }
    res.set("Cache-Control", "public, max-age=60");
    res.json(branding);
  } catch (err) {
    res.status(500).json({ error: "Internal", message: "Gagal memuat branding." });
  }
});

export { router as siteRouter };
