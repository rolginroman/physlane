# physlane

Adaptive TDEE and recomp tracker for lifters. Manual numbers only: weigh in, log calories, and the engine learns *your* burn rate from your own series — no food database, no integrations, under 60 seconds a day.

**Live:** https://physlane.unpackit.top (also https://physlane.irolgin.workers.dev)

## Stack

- TanStack Start (React 19, file-based routes, server functions) + Vite
- Cloudflare Workers + D1 (drizzle-orm, drizzle-kit migrations)
- better-auth (email/password, sessions)
- Stripe (checkout + billing portal + webhook; **pre-launch: degrades gracefully until keys are configured**)
- Tailwind v4 (single dark theme), Recharts, vitest

## Commands

```
pnpm install
pnpm dev                  # dev server on :3000 (needs local D1 migrations first)
npx wrangler d1 migrations apply physlane --local
pnpm typecheck && pnpm test && pnpm build
```

Deploy: `pnpm build && npx wrangler deploy -c dist/server/wrangler.json`
(secrets: `wrangler secret put AUTH_SECRET`; Telegram: `TELEGRAM_BOT_TOKEN` + `TELEGRAM_BOT_USERNAME` + `CRON_SECRET` for mini app + reminders; Stripe keys when billing launches)

## Layout

- `src/lib/` pure logic (tdee, projection, adherence, units) + tests — no I/O
- `src/server/*.fns.ts` server functions (owner-checked, DTO-only) · `auth.core.ts` plain auth logic
- `src/routes/` landing, auth pages, `_auth.*` app routes · `src/components/` UI
- `migrations/` D1 migrations · `PRODUCT.md` / `DESIGN.md` product + design contract

## Plan gates

`user.plan` is written **only** by the Stripe webhook (`src/routes/api.stripe.webhook.ts`).
Pro features (adaptive TDEE, projection, verdicts, full history, GLP-1 mode) are gated server-side; numbers never reach free clients.

## Status (Oct 2026)

MVP shipped (M1–M6). v3 (Oct 17): body-measurement parity — per-site trend charts (10 sites), cm/in display parity, per-site deltas, US Navy body-fat estimate (optional height/sex), free CSV export; Telegram Mini App via `tele-better-auth` (zero-tap sign-in, auto account, link via Settings), daily reminder bot endpoint (`/api/telegram/remind`, cron-secret guarded, inert until secrets set), read-only share cards (`/share/:token`, privacy-scoped). Stripe is Q4: webhook + checkout/portal UI are live but intentionally inert until `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` are set. Telegram live wiring (bot token, BotFather menu, reminder cron) pending bot creation.
