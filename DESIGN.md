# DESIGN.md — physlane v2 design system

Base: the gym-web dark-slate dashboard theme (user's own proven fitness dashboard), near-verbatim.
One theme across landing and app. Tailwind v4 `@theme` tokens live in `src/styles.css`.

## Surfaces & text tokens

- bg `#0b0d10` · surface `#11141a` · surface2 `#171b23`
- line `#232936` · line2 `#2e3646`
- text `#e6eaf2` · dim `#8b94a7` · faint `#5b6475`

## Accent

Single accent: emerald `#34d399` (dim `#10b981`). CTA, active state, convert moments ONLY.
Color strategy: Restrained (tinted neutrals + one accent ≤10%) for product surfaces; the landing
may push scale, not chroma.

## Chart series semantics (fixed)

- weight: blue `#60a5fa`
- waist: amber `#fbbf24`
- intake: violet `#a78bfa`
- risk/verdict: rose `#fb7185`
- target/projection lines: dim (`--color-dim`) dashed

## Typography

- Geist (sans) everywhere; JetBrains Mono for ALL numerics.
- `.num` class: mono + tabular-nums. Dense rows must align.
- Landing display scale (cloudflare discipline): tight grotesk tracking −0.025em, line-height ~0.99
  on the hero headline. App headings: normal tracking, hierarchy via scale + weight (≥1.25 ratio
  between steps).
- Body line length 65–75ch; base 16px mobile.

## Layout rules

- Mobile-first, usable at 360px. Condensed data-dense: slim rows, compact grids, not spacious cards.
- Cards only where they are the best affordance; no nested cards; no identical icon-card grids.
- No side-stripe borders. No gradient text. No glassmorphism. No modal-as-first-thought.
- Focus rings: `outline: 2px solid var(--color-accent); offset 2px` on `:focus-visible`.
- Touch targets ≥44px; inputs ≥44px on mobile; semantic keyboards (`inputmode=numeric` for numbers).
- Charts: client-only mounts (Recharts), legend interactive, tooltip on interact, subtle gridlines,
  tabular numerics, empty-data state ("No data yet" + how to get data), error state with retry.

## Motion

Transform/opacity only, ease-out (quart/quint/expo), 150–300ms. Respect prefers-reduced-motion.

## Copy

No em dashes in UI copy (commas, colons, semicolons, periods, parentheses). No restated headings.
Every word earns its place. Error messages state cause + how to fix.

## Landing-specific

Register: brand. Hero thesis comes from the subject's world (the trend line, the burn rate), never
the "big number + small label" template. No AI-slop gradients; one chromatic signal. Landing uses
the same tokens at larger sizes (display scale above); no second theme.
