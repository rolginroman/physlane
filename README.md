# physlane

Adaptive TDEE and recomp tracker for lifters. Manual numbers only: weigh in, log calories, and the engine learns *your* burn rate from your own series — no food database, no integrations, under 60 seconds a day.

**Live:** https://physlane.unpackit.top (also https://physlane.irolgin.workers.dev)

## Stack

- TanStack Start (React 19, file-based routes, server functions) + Vite
- Cloudflare Workers + D1 (drizzle-orm, drizzle-kit migrations)
- better-auth (email/password, sessions)
- Stripe (checkout + billing portal + webhook; **pre-launch: degrades gracefully until keys are configured**)
- Tailwind v4, Recharts, vitest (code still ships the legacy dark theme; target is the light + dark system in `DESIGN.md`)

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
- `migrations/` D1 migrations · `DESIGN.md` (Design Language System v2, source of truth) · `PRODUCT.md` funnel + monetization

## Plan gates

`user.plan` is written **only** by the Stripe webhook (`src/routes/api.stripe.webhook.ts`).
Pro features (adaptive TDEE, projection, verdicts, full history, GLP-1 mode) are gated server-side; numbers never reach free clients.

## Status (Oct 2026)

MVP shipped (M1–M6). v3 (Oct 17): body-measurement parity — per-site trend charts (10 sites), cm/in display parity, per-site deltas, US Navy body-fat estimate (optional height/sex), free CSV export; Telegram Mini App via `tele-better-auth` (zero-tap sign-in, auto account, link via Settings), daily reminder bot endpoint (`/api/telegram/remind`, cron-secret guarded, inert until secrets set), read-only share cards (`/share/:token`, privacy-scoped). Stripe is Q4: webhook + checkout/portal UI are live but intentionally inert until `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` are set. Telegram live wiring (bot token, BotFather menu, reminder cron) pending bot creation.

## Stripe launch runbook

Launch-day checklist (test and live are separate Stripe accounts/objects — repeat per mode).

- [ ] **Catalog** — Reproduce product + prices: `pnpm stripe:fixtures` ([Stripe CLI](https://docs.stripe.com/stripe-cli) required; fixture format: [CLI fixtures](https://docs.stripe.com/cli/fixtures)). Copy returned `price_…` IDs into config (below).
- [ ] **One subscription per customer** — In Dashboard → Checkout / Payment Links settings, enable [Limit customers to one subscription](https://docs.stripe.com/payments/checkout/limit-subscriptions). This is the Stripe-side guard against a customer completing checkout twice (e.g. two tabs); app code does not replace it.
- [ ] **Payment methods** — Disable [Cash App Pay](https://docs.stripe.com/payments/cash-app-pay) for checkout (Dashboard payment method settings; see [integration options](https://docs.stripe.com/payments/payment-methods/integration-options)).
- [ ] **Webhook** — Register `POST /api/stripe/webhook` on your production URL. Subscribe to **only** `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted` ([webhook setup](https://docs.stripe.com/webhooks)).
- [ ] **Test ↔ live** — Recreate products/prices, webhook endpoint + signing secret, and API keys per mode; objects do not cross modes ([API keys](https://docs.stripe.com/keys)). At live launch, swap `STRIPE_PRICE_MONTHLY` / `STRIPE_PRICE_YEARLY` in `wrangler.jsonc` to the live `price_…` IDs.
- [ ] **Env matrix** — `.dev.vars` (local overrides, incl. price IDs; copy from `.dev.vars.example`), `wrangler.jsonc` `vars` (deployed public price IDs), `wrangler secret put STRIPE_SECRET_KEY` and `wrangler secret put STRIPE_WEBHOOK_SECRET` for secrets ([Wrangler secrets](https://developers.cloudflare.com/workers/configuration/secrets/)).
- [ ] **Manual smoke (launch day)** — `stripe listen --forward-to localhost:3000/api/stripe/webhook`, complete checkout with test card `4242…`, confirm `user.plan` flips in D1; cancel in portal and confirm revert. Not automated in CI.
