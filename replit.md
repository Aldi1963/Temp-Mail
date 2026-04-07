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
- Header shows user dropdown (Dashboard, Admin panel, Logout) when logged in
- `/login` and `/register` pages
- `/dashboard` — personal stats (total emails, messages, active) + email history
- `/admin` — Admin panel with tabs: Settings, Domain management, User management, Statistics
- Protected routes: `/dashboard` requires auth, `/admin` requires admin role

**Auth API Routes (not in OpenAPI spec, use fetch with credentials: "include"):**
- `POST /api/auth/register` — `{email, password}` — create account, first user = admin
- `POST /api/auth/login` — `{email, password}` — login
- `POST /api/auth/logout` — logout
- `GET /api/auth/me` — current user info
- `GET /api/user/emails` — user's email history
- `GET /api/user/stats` — user's usage stats
- `GET /api/admin/stats` — system-wide stats (admin only)
- `GET /api/admin/users` — list all users (admin only)
- `PATCH /api/admin/users/:id/role` — change user role (admin only)
- `DELETE /api/admin/users/:id` — delete user (admin only)
- `GET /api/admin/settings` — get site settings (admin only)
- `PUT /api/admin/settings` — save site settings (admin only)

**DB Tables:** `users`, `site_settings`, `user_sessions` (session store), `email_addresses` (with userId FK), `messages`, `blocked_senders`

**Session note:** `user_sessions` table is auto-created on API server startup via `ensureSessionTable()` in `index.ts`.

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.
