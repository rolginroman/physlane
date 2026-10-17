# physlane — SEO context

Built from the repo and the live site on 2026-10-17. Every fact names its source.

## Product

- **What:** adaptive TDEE tracker for lifters. Learns the user's real daily calorie burn from their own morning weigh-ins and daily calorie totals (weekly energy-balance math), not a population formula. (src/routes/index.tsx, src/lib/tdee.ts)
- **Who buys:** people losing fat or building muscle who want their actual maintenance calories; GLP-1 users are an explicit segment (GLP-1 mode, Pro). (src/routes/index.tsx FAQ + FEATURES)
- **Core loop:** weigh in → log day's calories (+optional protein) → read trend; burn estimate appears on day 14 of logging. (src/routes/index.tsx HowItWorks)
- **No food database, no barcode scanning, no photos, no bank/social connections.** (src/routes/index.tsx FAQ)

## Pricing (source: src/routes/index.tsx Pricing + FAQ)

- Free: weight + body-measurement logging, daily calories, trend charts with goal line, goal phases, streaks, 90 days of history.
- Pro $10/mo or $100/yr: daily-burn estimate, on-track verdicts, 4-week projection, unlimited history, GLP-1 mode. Cancel anytime, runs to end of paid period.

## Site (source: wrangler.jsonc, live crawl 2026-10-17)

- Canonical origin: `https://physlane.unpackit.top` (Cloudflare Workers, TanStack Start SSR). `physlane.com` has **no DNS** — decision needed (see reports).
- Public indexable: `/` only. `/sign-in`, `/sign-up`: noindex since 2026-10-17. App routes `/dashboard /onboarding /intake /cycles /billing` redirect (soft 200) to sign-in and are robots-disallowed.
- robots.txt: allows `/`, disallows app routes + `/api/`. Sitemap: `/` only, lastmod 2026-10-17.
- Structured data on `/`: SoftwareApplication (offers 0/10/100 USD) + FAQPage (5 Q&A).

## Stack facts (source: package.json, wrangler.jsonc)

- TanStack Start + React 19 on Cloudflare Workers, D1 (drizzle), better-auth, Stripe billing. Tests: vitest. CI+deploy on push to main (GitHub Actions).

## Competitors

- MacroFactor (macrofactorapp.com) — the closest match: adaptive TDEE + macro coaching, subscription.
- Cronometer (cronometer.com, ~564 sitemap URLs) — deep food-database tracking.
- MyFitnessPal — the default calorie counter; physlane's deliberate opposite (no food db).
- Free "TDEE spreadsheet" (r/Fitness) and tdeecalculator.net — the free alternative people graduate from.
