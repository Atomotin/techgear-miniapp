# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

TechGear: a Telegram Mini App storefront (catalog, cart, orders) with an admin panel and a Telegram bot. Plain Node.js `http` server with **zero npm dependencies** — no framework, no bundler, no build step, no linter. Deployed on Railway (`railway.json` → `npm start`); production data lives in Supabase. User-facing text and docs are in Russian/Uzbek.

## Commands

- `npm start` — run `server.js` (port from `PORT`, default 3000).
- `npm run smoke` — the only test suite (`scripts/smoke.js`). Spawns `server.js` on a free port with fake admin/bot credentials and hits the HTTP API end to end (pages, health, public catalog, admin login, catalog import, order create/validation). There is no way to run a single check; it is one sequential `main()`.
- `npm run start:local` — `start-local.ps1`: reads `local.env` (git-ignored; created on first run), opens a cloudflared tunnel, passes its URL as `PUBLIC_BASE_URL` so a **test** bot's webhook points at this machine. Never put the real shop bot token in `local.env` — startup re-registers the webhook.
- `node --check <file>` — the practical syntax check, since there is no linter.

Smoke runs against the local JSON storage in `data/` (unless Supabase env vars are set in the shell — make sure they are not). It snapshots and restores `data/*.json` (+ `.bak`) and deletes `.tmp`/`.corrupt-*` files and smoke uploads it created.

## Architecture

**Composition in `server.js`.** All env parsing, sanitizers/validators (`sanitizePersonName`, `validateOrderPayload`, …) and wiring live in `server.js`. Modules in `src/server/` are factories (`createXxx({ deps })`) that receive their dependencies explicitly — when a module needs something new, add it to the factory's parameters and pass it from `server.js` (and through `src/server/api.js` for routes).

**Routing.** `src/server/api.js` tries each handler in `src/server/routes/` (telegram → public → orders → profile → admin) in order; a handler returns `true` if it handled the request. Routes match on `url.pathname` manually. Anything not under `/api/` falls to `src/server/static.js`, which serves `public/` (`/` → `index.html`, `/admin` → `admin.html`) and uploaded files.

**Two storage backends, one interface.** `src/server/storage/index.js` picks Supabase when `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` are set, otherwise local JSON files in `data/`. Both providers (`storage/local.js`, `storage/supabase.js`) implement the same async methods (`getCatalog`, `createOrder`, `updateOrderStatus`, `createProduct`, `importCatalog`, banners, settings, customers, `getDiagnostics`, …); common normalization is in `storage/shared.js`. **Any data-model change must be made in `local.js`, `supabase.js` and `supabase/schema.sql` together.** Local writes are atomic (temp file + rename, with `.bak` backups).

**Persistence guard.** `REQUIRE_PERSISTENT_ADMIN_STORAGE` (defaults to true on Railway/production) makes admin writes return 503 if `storage.getDiagnostics()` reports non-persistent storage — Railway's filesystem is ephemeral, so local JSON there would silently lose data.

**Auth.**
- Customers: the Mini App sends Telegram `initData` in the `x-telegram-init-data` header; `src/server/telegram-auth.js` verifies the HMAC with the bot token. Orders/profile routes use `getVerifiedTelegramUser`.
- Admin: `src/server/admin-auth.js` — password login → signed token (`ADMIN_SECRET`, 12h TTL). Login is disabled while `ADMIN_PASSWORD` is a default like `change-me` or shorter than 12 chars.
- Telegram webhook (`/api/telegram/webhook`) always requires a secret; if `TELEGRAM_WEBHOOK_SECRET` is missing/invalid a random one is generated per start and registered via `setWebhook`.
- `src/server/rate-limit.js` throttles orders (per IP, per IP daily, per Telegram user) and profile writes. Uploads (`uploads.js`) accept only jpg/png/webp/mp3 — SVG is intentionally rejected (script execution on this origin).

**Telegram notifications** (`src/server/telegram.js`) are fire-and-forget: order creation must never fail or wait because Telegram is down.

**Catalog seeding.** On first run with an empty catalog, the server seeds from `card-tovary.js` (legacy browser script defining globals) by evaluating it in a `vm` sandbox.

**Frontend.** `public/index.html` loads `telegram-web-app.js`, then `js/app.js`, `catalog.js`, `cart.js`, `profile.js` as plain global scripts (order matters; no modules). `app.js` reads bootstrap data from `window.TECHGEAR_*` globals and `window.Telegram.WebApp`. `public/admin.html` + `js/admin.js` is the admin SPA. Bind events with `addEventListener`, not inline `onclick`.

## Data and secrets

- `data/orders.json` and `data/customers.json` contain real customer PII and are git-ignored; do not commit or hand-edit them. `data/catalog.json`, `banners.json` are tracked.
- Env vars are documented in `.env.example`; Railway + Supabase setup is in `SETUP_RAILWAY_SUPABASE_RU.md`.
- `.claude/hooks/protect-files.js` blocks Claude from editing `local.env`, `.env`, `data/orders.json`, `data/customers.json`.
