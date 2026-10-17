# AUDIT — physlane v2 MVP (2026-10-17)

## Verification evidence

- **Gates:** `pnpm typecheck` exit 0 · `pnpm build` exit 0 · `pnpm test` 84/84 (6 files: tdee, units, intake-logic, adherence, lean-mass, projection)
- **Live:** https://physlane.unpackit.top 200 (custom domain) · https://physlane.irolgin.workers.dev 200 · robots.txt 200
- **D1 remote:** migrations 0000+0001 applied; prod rows at smoke time: 1 user, 1 cycle, 2 measurements
- **Smoke (plan §6), production, real browser:** signup → 3-step onboarding (cut −0.5 kg/wk, 82.5 kg, 2100 kcal) → dashboard → quick log (82.1 kg / 84 cm) → rows + stats + TDEE panel (collecting state, free-gate, GLP-1 row) rendered
- **Interactive UI checks:** chart paints (SVG + curves) with ≥2 points, range pills, unit toggle flips kg↔lb without reload, inline delete confirm, guard redirects (307) when unauthenticated

## Invariants

- **I2** single active cycle: auto-end on create (cycles.fns.ts) — verified
- **I4/BR2** `user.plan` written only in `api.stripe.webhook.ts` — grep-verified across src/
- **BR5** all server fns owner-checked via requireUser
- **Pro gating** free DTOs return null kcal/spread/weeklyEstimates/projection (server-side, verified in intake.fns.ts)
- **Secrets** none in repo; `.env`/`.dev.vars*` gitignored; `wrangler secret` for AUTH_SECRET; Stripe keys absent by design (Q4)

## Deviations from plan

1. **URL:** plan said physlane.workers.dev; account subdomain is `irolgin` and rename is token-blocked → shipped physlane.unpackit.top (+ workers.dev fallback). User informed; dashboard rename remains an option.
2. **Milestone commits on main:** direct push declined by branch protection → PR #5 (squash b3bef0c) merged instead. CI+docs follow-up on branch `v2-ci-docs`, left unmerged per user instruction.
3. **M3 commit** was authored by the implementer subagent despite instructions (contents verified identical to spec, kept).
4. **Stripe live config** (M6) intentionally deferred to Q4 — webhook returns 503 'billing not configured'; billing UI shows pre-launch state.

## Known minor items (non-blocking)

- Bot scanners probe /.env, /CLAUDE.md etc.; assets fallback serves the SPA shell — nothing sensitive deployed. Consider explicit 404s for dotfiles.
- Landing og:image is a generated placeholder on-token PNG.
- wrangler deploy MUST use `-c dist/server/wrangler.json` (root wrangler.jsonc `main` is the dev entry; deploying with it drops the server-fn manifest → "Server function info not found"). Documented in README.

## v3 evidence (Oct 17, 2026 — measurements + Telegram)

- **Gates:** typecheck 0 · tests 154/154 (12 files; +49 since v2: navy-bf 14, units/csv/remind/share/initData coverage) · build green.
- **Commits (v3-measurements-telegram):** 5d3ba5c (G1.4 height/sex + Navy BF + migration 0003) · 1690f87 (G1.1-3+G1.5 charts/units/deltas/CSV) · 8bb522e (tele-better-auth wiring + migration 0004 + initData crypto tests) · a9172d1 (reminders + share cards + migration 0005) · 77aa795 (WebApp UI adapter) · G3 docs/landing.
- **Prior-art decision:** Telegram auth via `tele-better-auth@1.7.1` (peer `better-auth ^1.7.7` = our 1.7.10). Rejected `better-auth-telegram` (peer `<1.7.0` → live-auth downgrade) and hand-rolled HMAC. Our integration test signs initData with node:crypto and asserts the plugin's validate accepts valid + rejects tampered/stale/missing-hash.
- **Deviations v3:** (1) Navy formula uses published CENTIMETRE coefficient form — the inch-form coefficients in the original spec produce ~9.8% where anchors require ~16.1%; verified against the published inch linear form (86.010/−70.041/+36.76 → 16.1%). (2) Reminder cron + BotFather menu wiring parked pending bot token; endpoint deployed and returns `{sent:0,reason:'unconfigured'}`. (3) No landing "works in Telegram" claim until the bot is actually reachable (honest-claims rule).
- **Security surfaces:** share DTO leaks no email/telegram identity (first name only); remind endpoint constant-time cron-secret check; plan writes still Stripe-webhook-only; no secrets in repo (dummy token in tests only).
