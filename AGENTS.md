# Agent guidelines

TanStack Start on Cloudflare Workers, D1 + Drizzle, Vitest, pnpm. Follow these rules on every change.

## Done gate

Before claiming work is complete, run the same checks as CI and fix failures: format check, lint, typecheck, test, build (`pnpm` scripts).

## Lint and format

Use oxlint and oxfmt with oxfmt defaults: 2-space indent, double quotes, print width 80. Run format and lint via package scripts; CI runs format check and lint before typecheck.

## File names

Use kebab-case for every source file, including components (e.g. `trend-chart.tsx`). Keep framework-mandated names only where required (TanStack file routes under `src/routes/`, `routeTree.gen.ts`, config files).

## Exports

Use named exports everywhere. Use a default export only when a tool requires it (config files, MDX). oxlint `no-default-export` applies with documented overrides.

## Modules

When a domain has two or more files, use a folder `src/lib/<domain>/`. Do not add barrel files. Do not add `index.ts`; name files by content (e.g. `posts.ts` not `index.ts`). Import the concrete file path.

## Imports

Use `#/` for cross-directory imports. Use `./` only for same-directory siblings. Do not use `../` except tests in `__tests__/` importing the subject via `../`.

## Tests

Place tests in co-located `__tests__/` inside each source directory (e.g. `src/lib/__tests__/tdee.test.ts`). Vitest includes `src/**/__tests__/**/*.test.{ts,tsx}`.

Test pure logic in `lib/` and `server/*.core.ts`. Cover composed behavior only. Do not test that a feature or export exists. Do not assert a constant’s literal value. When auditing or removing bad tests, use the test-audit skill.

## Server layering

Keep `*.fns.ts` thin: zod parse, `requireUser`, DB I/O, call core, map to DTO. Put decisions in `*.core.ts` or `src/lib/`; core and lib must not import db, env, or fetch.

Enforce Pro on the server; free DTOs return null for Pro fields. Write `user.plan` only in `src/routes/api.stripe.webhook.ts`.

## Validation

Every `createServerFn` that accepts input uses a zod schema; derive input types with `z.infer`.

## Errors

Use one `AppErrorCode` string-literal union and `appError(code)` in `src/lib/`. Keep the wire shape (message equals code). Map codes to UI copy in the client.

## TypeScript strictness

Keep `strict` and `noUnused*`. Enable `noUncheckedIndexedAccess`. Treat `any` as an error (`no-explicit-any`). Use `as` casts only at trust boundaries, with a one-line why comment.

## UI

Follow [DESIGN.md](./DESIGN.md) v2 token **values**; for the merged palette set, those values live under shadcn canonical names (see `plans/shadcn-baseui-report.md` token merge table). Transitional v2 aliases (`bg-canvas`, `text-ink`, etc.) are deprecated — do not use them in new code. Do not use raw hex or Tailwind palette colors in components. When touching legacy v1 dark/emerald UI, remove it in favor of v2.

## Comments

Write why-only comments, sparingly. Add one-line JSDoc on exported functions when behavior is non-obvious. Do not narrate what the code does.

## Product copy

Follow [PRODUCT.md](./PRODUCT.md) for funnel and journeys. State only shipped, reachable capabilities; no marketing claims for missing or unreachable features.

## Deploy and secrets

Deploy with `wrangler deploy -c dist/server/wrangler.json`. Set secrets with `wrangler secret put`. Never commit `.dev.vars`.

## Database migrations

Generate with `pnpm db:generate`. Never edit a migration after it has merged.

## Commits

Use Conventional Commits with scope, e.g. `feat(billing): …`. Do not add `Co-Authored-By` or any other commit trailer.
