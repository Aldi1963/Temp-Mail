import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import { pool } from "@workspace/db";
import router from "./routes";
import { logger } from "./lib/logger";

const PgSession = connectPgSimple(session);

const app: Express = express();

app.set("trust proxy", 1);

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);

const PRODUCTION_ORIGINS = [
  "https://mail.clipku.com",
  "http://mail.clipku.com",
  "https://m.clipku.com",
  "http://m.clipku.com",
  // Aplikasi Android (Capacitor) berjalan di origin lokal ini
  "https://localhost",
  "capacitor://localhost",
];
const extraOrigins = (process.env.CORS_EXTRA_ORIGINS || "")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);
const allowedOrigins = [...PRODUCTION_ORIGINS, ...extraOrigins];

app.use(
  cors({
    origin: (origin, callback) => {
      // Request tanpa header Origin (same-origin / non-browser) selalu diizinkan
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) return callback(null, true);
      // Origin tidak dikenal: JANGAN kirim error (500), cukup tanpa header CORS
      // sehingga browser memblokir pembacaan respons lintas-situs.
      callback(null, false);
    },
    credentials: true,
  }),
);

app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true, limit: "2mb" }));

const isProduction = process.env.NODE_ENV === "production";
const sessionSecret = process.env.SESSION_SECRET;
if (!sessionSecret) {
  if (isProduction) {
    throw new Error("SESSION_SECRET wajib di-set di production (.env) — server ditolak start.");
  }
  logger.warn("SESSION_SECRET kosong: memakai fallback dev yang tidak aman. Jangan dipakai di production.");
}

app.use(
  session({
    store: new PgSession({
      pool,
      tableName: "user_sessions",
    }),
    name: "tempmail.sid",
    secret: sessionSecret || "insecure-dev-fallback-DO-NOT-USE-IN-PROD",
    resave: false,
    saveUninitialized: false,
    cookie: {
      maxAge: 7 * 24 * 60 * 60 * 1000,
      httpOnly: true,
      sameSite: "lax",
      secure: isProduction,
    },
  }),
);


// Serve static frontend build and SPA fallback for routes like /admin, /dashboard, /login, etc.
import path from "path";
const distPath = path.resolve(process.cwd(), "artifacts/tempmail/dist/public");
app.use(express.static(distPath));

// SPA fallback BEFORE the /api router: in Express 5, app.use("/api", router)
// prefix-matches paths like /api-docs (no slash) and would swallow them into
// a router 404. The fallback skips real /api/* requests itself.
app.use((req, res, next) => {
  const isApi = req.path === "/api" || req.path.startsWith("/api/");
  if (req.method === "GET" && !isApi) {
    return res.sendFile(path.join(distPath, "index.html"));
  }
  next();
});

app.use("/api", router);

export default app;
