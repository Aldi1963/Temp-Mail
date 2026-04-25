# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)

## Artifacts

### TempMail (artifacts/tempmail)
A full-featured temporary email service similar to temp-mail.org.

**Features:**
- Auto-generate random disposable email addresses with domain selection
- Inbox with auto-refresh every 5 seconds (polling)
- Email viewer with HTML/text body rendering (sandboxed iframe)
- Mark-as-read on message open
- Filter by All / Unread / Read, search by sender/subject
- Stats panel: total messages, unread count, expiry countdown timer
- Clear inbox with confirmation dialog
- New mail sound notification (Web Audio API)
- Dark mode toggle (persists in localStorage)
- Responsive design (mobile + desktop)

**Frontend:** React + Vite at `/` (artifacts/tempmail)
**Backend:** Express API at `/api/email/...`

**API Routes:**
- `GET /api/email/generate` — Generate a new temp email
- `GET /api/email/inbox?email=` — Get inbox messages
- `GET /api/email/message?id=&email=` — Get full message
- `PATCH /api/email/message/read` — Mark message as read
- `DELETE /api/email/reset?email=` — Clear inbox
- `GET /api/email/domains` — List available domains
- `GET /api/email/stats?email=` — Get inbox stats

**Domains available:** tmpmail.dev, quickmail.io, throwaway.net

**Email TTL:** 10 minutes (auto-expires from DB)

**Auth & Dashboard features:**
- User registration & login with bcrypt password hashing
- Session-based auth (express-session + connect-pg-simple, stored in `user_sessions` PostgreSQL table)
- First registered user auto-becomes admin
- Header shows user dropdown (Dashboard, Profile, Developer Tools, Admin panel, Logout) when logged in
- `/login` and `/register` pages
- `/dashboard` — personal stats (total emails, messages, active) + email history
- `/profile` — change password, 2FA setup/disable
- `/developer` — API key management + webhook management
- `/admin` — Admin panel with sidebar: Ringkasan, Pengaturan Umum, Pengaturan Web, Domain, Pengguna, Statistik
- Protected routes: `/dashboard`, `/profile`, `/developer` require auth; `/admin` requires admin role

**Auth API Routes:**
- `POST /api/auth/register` — create account, first user = admin
- `POST /api/auth/login` — login; returns `{requires2fa: true}` if 2FA is enabled
- `POST /api/auth/logout` — logout
- `GET /api/auth/me` — current user info
- `POST /api/auth/change-password` — change password
- `GET /api/auth/2fa/status` — 2FA enabled status
- `POST /api/auth/2fa/setup` — generate TOTP secret + QR code
- `POST /api/auth/2fa/enable` — verify TOTP + activate 2FA (returns backup codes)
- `POST /api/auth/2fa/disable` — verify TOTP + deactivate 2FA
- `POST /api/auth/2fa/verify-login` — complete 2FA login step

**Developer API Routes:**
- `GET /api/developer/keys` — list API keys
- `POST /api/developer/keys` — create API key (returns raw key once only)
- `DELETE /api/developer/keys/:id` — delete API key
- `GET /api/developer/webhooks` — list webhooks
- `POST /api/developer/webhooks` — create webhook (returns secret once only)
- `PATCH /api/developer/webhooks/:id` — toggle active
- `DELETE /api/developer/webhooks/:id` — delete webhook
- `POST /api/developer/webhooks/:id/test` — send test payload

**DB Tables:** `users`, `site_settings`, `user_sessions`, `email_addresses`, `messages`, `blocked_senders`, `api_keys`, `webhooks`, `user_two_factor`

**2FA:** TOTP via `speakeasy` library + QR code via `qrcode`. Backup codes (8x hex) generated on enable.

**API Key Auth:** Use `X-API-Key: tmk_xxx` header. Keys start with `tmk_`, prefix stored plaintext for lookup, hash stored for verification. Middleware: `requireAuthOrApiKey` in `lib/auth.ts`.

**Webhook Signature:** HMAC-SHA256 over JSON body using webhook secret, sent in `X-TempMail-Signature` header.

**Session note:** `user_sessions` table is auto-created on API server startup via `ensureSessionTable()` in `index.ts`.

**Cloudflare Email Routing integration:** The `cloudflare-worker/` folder contains two Email Worker scripts (simple version for browser deploy, full version with `postal-mime` for Wrangler deploy) that bridge Cloudflare Email Routing to the TempMail `/api/webhook/inbound-email` endpoint. See `cloudflare-worker/README.md` for the end-to-end setup guide (domain prep, secret retrieval, deploy via Dashboard or Wrangler/Termux, routing rule, and troubleshooting).

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.
