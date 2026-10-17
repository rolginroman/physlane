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
