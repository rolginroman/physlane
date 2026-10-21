# physlane

Adaptive TDEE and recomp tracker for lifters. Manual numbers only: weigh in, log calories, and the engine learns _your_ burn rate from your own series — no food database, no integrations, under 60 seconds a day.

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
(secrets: `wrangler secret put AUTH_SECRET`; Telegram: `TELEGRAM_BOT_TOKEN` + `TELEGRAM_BOT_USERNAME` + `CRON_SECRET` for mini app + reminders; Stripe keys when billing launches; PostHog `POSTHOG_KEY` when analytics launches)

## Layout

- `src/lib/` pure logic (tdee, projection, adherence, units) + tests — no I/O
- `src/server/*.fns.ts` server functions (owner-checked, DTO-only) · `auth.core.ts` plain auth logic
- `src/routes/` landing, auth pages, `_auth.*` app routes · `src/components/` UI
- `migrations/` D1 migrations · `DESIGN.md` (Design Language System v2, source of truth) · `PRODUCT.md` funnel + monetization

## Plan gates

`user.plan` is written **only** by the Stripe webhook (`src/routes/api.stripe.webhook.ts`).
Pro features (adaptive TDEE, projection, verdicts, full history, GLP-1 mode) are gated server-side; numbers never reach free clients.

## Connect your AI

Hosted MCP at **`POST /mcp`** (Streamable HTTP, [MCP protocol 2026-07-28](https://modelcontextprotocol.io); legacy protocol versions are rejected). Auth is OAuth 2.0 through the app’s better-auth IdP (dev issuer: `http://localhost:3000/api/auth`).

**URL (paste into the host):**

| Environment | MCP URL                             |
| ----------- | ----------------------------------- |
| Production  | `https://physlane.unpackit.top/mcp` |
| Local dev   | `http://localhost:3000/mcp`         |

Hosts that implement MCP OAuth discovery (`/.well-known/oauth-protected-resource`) — Claude, Cursor, MCP Inspector, pi, etc. — connect with that URL only; no manual client ID unless your host requires it.

**OAuth (verified on dev):**

- Dynamic client registration: `POST /api/auth/oauth2/register` (DCR).
- Token endpoint: `client_secret_basic` (HTTP Basic with `client_id` / `client_secret`).
- Authorize: clients sending `Accept: application/json` get `{ "redirect": "<url>" }` (not a 303).
- PKCE required. Resource indicator: `http://localhost:3000/mcp` in dev (`https://physlane.unpackit.top/mcp` in prod).

**Human step:** when the host opens the consent screen, sign in to physlane and click **Allow**.

**Scopes**

| Scope       | Tools                                                                 |
| ----------- | --------------------------------------------------------------------- |
| `mcp:read`  | `get_status`, `get_history`                                           |
| `mcp:write` | `log_intake`, `log_measurement`, `set_cycle`, `apply_measured_target` |

Missing scope → HTTP **403** `insufficient_scope` with `WWW-Authenticate` naming the required scope.

**Tools (6)**

| Tool                    | Scope | Notes                                                                                                                                                      |
| ----------------------- | ----- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `get_status`            | read  | Units, plan, active cycle, TDEE snapshot; Pro-gated estimate numbers stay hidden on free (same as the app).                                                |
| `get_history`           | read  | `kind`: `intake` \| `measurements` \| `cycles`; optional `from` / `to`; `limit` ≤ 400 (default 120). Free plan: 90-day clamp on intake.                    |
| `log_intake`            | write | `date`, `kcal`, optional `proteinG`; idempotent per date.                                                                                                  |
| `log_measurement`       | write | **`unit` required:** `metric` \| `imperial`; converts to canonical kg/cm before save.                                                                      |
| `set_cycle`             | write | `phase`: `cut` \| `bulk` \| `maintain`; optional `startDate`, `targetRateKgPerWeek` in [-1.5, 1], `kcalTargetPerDay` in [1, 20000]; ends any active cycle. |
| `apply_measured_target` | write | **Pro only** — writes measured TDEE target to the active cycle (server-computed).                                                                          |

Telegram-only accounts (no password) cannot complete OAuth until email/password sign-in exists; use the web app for those users.

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
