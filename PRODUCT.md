# PRODUCT.md — physlane

> Visual identity, positioning language, copy rules, and theming are governed by `DESIGN.md`
> (Physlane Design Language System v2), which wins on any conflict. This file keeps the funnel,
> journeys, and monetization decisions.

## Product purpose

Physlane helps people understand their body's energy expenditure from their own weight and
calorie-intake data. Core message: **"Calorie apps guess. This one measures."** One daily loop under
60 seconds: weigh in, log a single intake number, watch the trend. Adaptive TDEE computed from the
user's own weight + intake series is the wedge. No food database, barcode scanner, or AI slop.

Audience (DESIGN.md §1.1): general weight-management users, gym-goers, strength-training
enthusiasts, body-composition-curious people, and anyone tired of conventional calorie tracking.
Lifters running cut/bulk cycles remain the primary acquisition channel (J1, J2), but Physlane is
not positioned exclusively as a bodybuilding, women's wellness, or medical product.

Register: **product** for the app (`/dashboard`, `/intake`, `/cycles`, `/onboarding`, `/billing`).
Register: **brand** for the landing page (`/`) only.

## Users

- **J1 "Cutter" (primary, ~70% of traffic):** discovered via "adaptive TDEE app" / "recomp tracker"
  searches or Reddit. Signs up with email, no card. Activates in under 2 minutes through the
  onboarding wizard (goal = cut, current weight, target rate, units, kcal starting point). Days
  1–13: daily loop, sees the "collecting data n/14" progress bar. Day 14: TDEE estimate exists and
  is Pro-gated (convert moment #1). Week 3+: rate verdicts and projection (convert #2). Day 90:
  history gate (convert #3).
- **J2 "Bulker":** identical loop, target +0.25 kg/wk, verdict copy flips ("too fast, fat-gain
  risk"). Same screens, different cycle-phase copy.
- **J3 "GLP-1 user" (later, /glp-1 funnel):** rapid loss + muscle fear; lean-mass-risk banner and
  Pro mode toggle are the convert moment. Not day-1 positioning.

Journey gates: activation = first log <24h · habit = 7-day streak · insight = 14 complete
(weight, kcal) pairs · convert = TDEE reveal / verdict / day-90 · retain = cycle rollover.

## Strategic principles

1. The empty dashboard is a dead end; the onboarding wizard is the fix, not polish.
2. Free users must SEE the TDEE progress bar ("collecting data n/14") — the tension builder. Never
   hide that the number is coming.
3. Daily loop budget: <60s total on mobile, one screen, quick-log pinned on the dashboard.
4. Convert moments surface where value is proven (next to the chart), never in a settings page.
5. Copy adapts to cycle phase (cut/bulk/maintain) from the same components.
6. Privacy: no bank/social integrations; only manual numbers stored. Say so plainly.

## Monetization

Pro = $10/mo or $100/yr: adaptive TDEE + rule-based coaching + unlimited history + GLP-1 mode.
(AI trainer coach is a post-launch fast-follow; photos a later plain utility.) Free tier: 90 days
of measurements + intake, full logging, charts, streak.

## Tone

See DESIGN.md §10. Confident, knowledgeable, direct, honest. Short sentences, active voice, clear
units, transparent about estimates, calm and nonjudgmental about weight trends. No hype, shame,
guilt, fear, or guaranteed outcomes. Numbers use stable tabular figures.

## Anti-references

- No food database / barcode / meal-photo AI, ever (locked decision D10).
- Visual anti-references: DESIGN.md §2.2 (no photoreal people, no gym clichés, no neon, no
  purple-blue SaaS, no glassmorphism overload, no calorie-shaming).
- Not GLP-1-first positioning (D3); Pro-only mode later.

## Surfaces

Web app (mobile-first, Light Editorial + Dark Performance themes per DESIGN.md §3) + SEO landing. Telegram Mini App is post-launch
(M9). Deploy: physlane.workers.dev.
