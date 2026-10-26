# Shareable training programs — build plan (Phase 1)

Status: design settled via grilling session (2026-10-25); revised same day after adversarial
review (4 blockers, 10 should-fix, 4 nits — all triaged; the Phase-3 paywall contradiction
is recorded as an open question in the appendix); link-recovery research round adopted
(`plans/link-recovery-research.md` — token-first resolution, bounded redirect caching,
365-day quarantine, guess-404 rejected, ID permalink adopted). Vocabulary: `CONTEXT.md` is
canonical. Decisions recorded in `docs/adr/0001-canonical-exercise-catalog.md` and
`docs/adr/0002-programs-are-author-owned-documents.md`. Competitive context:
`plans/programs-competitor-analysis.md`.

## What Phase 1 is

Any registered user authors structured training programs (weeks → sessions → exercise
entries), shares them via a public profile page or a rotating unlisted link, and any viewer
can fork a program into their own library. Free, unlimited, no Pro gating. Workouts logging
(Runs), paid access, and coaching are Phase 2/3 — out of scope here, but nothing in this plan
may block them (see ADR 0002 and the appendix).

## Resolved details worth restating

- **Unlisted reachability:** unlisted programs resolve only via their author-scoped token
  URL `/u/{authorSlug}/{programSlug}/{shareToken}` (noindex). The bare `/u/{author}/{slug}`
  URL exists only while public; going public → unlisted kills it — that is what "de-list"
  means. Entering unlisted from any other state mints a fresh token (so drafting revokes
  old links); explicit rotation also mints. While public, a token-suffixed URL 301s to the
  bare canonical URL. Resolution is **token-first**: when a token segment is present, the
  program is looked up by the globally unique token alone and the path prefix is ignored
  for access (it only forms the canonical target) — unlisted links survive author renames
  *and* claims. Possession-grant pattern as progress cards (`src/lib/share.ts`);
  the token stays in the address (random, rotatable) — the slug alone is never the grant.
  Consequence: both author and program slugs are minted at first *share* (unlisted or
  public), not at first public.
- **Slug reservation is quarantined, not eternal — rename abuse is bounded by design.**
  Author slug renames are rate-limited (one rename per 90 days; the first mint at first
  share is free). A rename writes a history row and 301s old paths to the current target
  by id (flattened, never chained; token suffix preserved). The old slug is reserved for a
  365-day quarantine window (Google advises redirects live ≥1 year for signal transfer —
  `plans/link-recovery-research.md`); afterwards anyone may claim it, and claiming deletes
  the redirect. One account therefore holds at most ~4 reserved author slugs at a time
  (current + ≤3 quarantined, capped by the keep-3 history rows) — bounded, so
  history-based hoarding is impossible. Links survive exactly
  as long as nobody else wants the name. Re-claiming your own quarantined slug is a normal
  rename (cooldown applies, row deleted on success). Program slug renames are unrestricted
  — the namespace is per-author, hoarding burns only your own. Claims check current slugs
  + unexpired history at scope; index-race losers get `SLUG_TAKEN`. First-mint
  first-come and multi-account squatting are moderation problems (impersonation reports
  → platform force-rename bypassing the cooldown, or profile hide), not slug mechanics.
  `public → unlisted/draft` still retains the slug so going public again reuses it.
- **Profiles exist only once something is public.** An unlisted-only author has a slug
  (minted at first share) but no profile page — `/u/{slug}` 404s until a program goes
  public. Unlisted views show a plain author line (no profile link).
- **Forks are snapshots** with a denormalized attribution label (author display name +
  title; plain text, never a link — a public fork must not make an unlisted original
  discoverable); born draft; never sync. `forkable` is a per-program boolean enforced by
  `forkProgram` from Phase 1 (paid programs set it false in Phase 3).
- **Two flagged micro-assumptions:** no program cover images in Phase 1; canonical kg stored,
  rendered per `user.unitSystem`.

## Data model (src/db/schema.ts, migration via `pnpm db:generate`)

Conventions as existing tables: text UUID ids, `unixepoch()` timestamps, canonical metric
units.

### `user` additions

- `slug` text nullable (unique index; multiple NULLs fine in SQLite) — set at the author's
  first share (unlisted or public); the profile *page* still renders only once a program
  is public.
- `displayName` text nullable — public name on profile and fork labels; defaults to
  `publicFirstName(user.name)` (existing first-name-only convention, `src/lib/share.ts`).
- `bio` text nullable. Avatar reuses better-auth `user.image`.
- `profileHiddenAt` timestamp nullable — platform moderation hide for profiles.

### `exercises` (catalog + custom — one table, same schema)

| column | shape |
|---|---|
| `id` | text PK (ours, never a source ID) |
| `ownerUserId` | text nullable — null = platform catalog entry; set = that author's custom exercise |
| `name` | text; unique normalized name per scope (global for catalog rows, per-owner for customs) |
| `aliases` | json string[] (search only) |
| `musclePrimary` | enum, one of `MUSCLES` (detailed muscle) — required for customs too |
| `muscleSecondary` | json, array of `MUSCLES` |
| `equipment` | enum: barbell/dumbbell/machine/cable/bodyweight/kettlebell/band/other |
| `formNote` | text nullable — one-liner reference cue |
| `deletedAt` | timestamp nullable — soft delete for customs still referenced by programs (renders in existing programs, hidden from pickers) |

`MUSCLES` is two-tier: 25 detailed muscles grouped into 8 body regions. Regions are a
derived map, not stored — an exercise's regions are computed from its primary + secondary
muscles. Ours; importers map coarse source groups to a canonical default muscle, and the
curation overlay refines the top lifts.

| region | muscles |
|---|---|
| chest | chest (sternal pec major), upper-chest (clavicular) |
| back | lats, traps, rhomboids, lower-back (erector spinae) |
| shoulders | front-delts, side-delts, rear-delts |
| arms | biceps, brachialis, triceps, forearms |
| core | abs, obliques, serratus-anterior |
| hips | glutes, adductors, abductors, hip-flexors |
| legs | quads, hamstrings, calves, tibialis-anterior |
| neck | neck |

"Hip extensors" is a movement pattern, not a muscle — tagging glutes + hamstrings covers
it; deliberately no redundant tag.

Indexes: `(name)`, `(ownerUserId)`. No DB-level FKs anywhere in the programs domain —
app-level integrity, matching the existing schema's style.

Rules: the editor picker offers catalog rows (`ownerUserId` null) plus the author's own
customs. An entry may reference a custom exercise owned by the program's author — including
after a fork, where entries keep referencing the original author's customs: they *render* in
the fork, but the fork's author cannot reuse them in their own new programs. Asset galleries
attach to customs exactly as to catalog entries.

### `exercise_assets`

- `id`, `exerciseId`, `kind` enum video/article/image, `url` (external — embedded or
  linked, never hosted by physlane), `title` (what/who it is, e.g. "Bench setup — channel
  name"), `sortOrder` int, `createdAt`
- index `(exerciseId, sortOrder)`; re-import merge key `(exerciseId, url)`
- The program view renders the first video inline; the rest show as a "References" gallery

### `programs`

- `id`, `userId` (author), `createdAt`, `updatedAt`
- `title`, `description`
- `slug` text nullable — assigned at first share transition (unlisted or public); unique
  per author (`uniqueIndex(userId, slug)`)
- `visibility` enum draft/unlisted/public, default draft
- `weeks` int; `goal` enum strength/hypertrophy/fat-loss/general; `level` enum
  beginner/intermediate/advanced; `daysPerWeek` int; `equipmentTags` json enum[]
- `shareToken` text nullable unique (issued at first unlisted transition; rotation overwrites)
- `forkedFromProgramId` text nullable; `forkSourceLabel` text nullable (denormalized
  "Author · Program title" at fork time; survives original deletion)
- `forkable` boolean notNull default true (enforced in `forkProgram` core from day one;
  written nowhere in Phase 1 UI)
- `hiddenAt` timestamp nullable — platform moderation hide; core refuses visibility changes
  on hidden programs
- `revision` int notNull default 0 — bumped on every mutation; editor sends its expected
  revision; mismatch → `STALE_REVISION` (kills two-tab last-write-wins)
- `deletedAt` timestamp nullable (soft delete)
- indexes: `(userId, visibility, deletedAt)` (profile listing), `(visibility, deletedAt)`
  (sitemap), unique `(userId, slug)`, unique `shareToken`

### `program_sessions`

- `id`, `programId`, `weekNumber` int, `orderIndex` int, `title` text (e.g. "Upper A"),
  `notes` text nullable
- index `(programId, weekNumber, orderIndex)`

### `program_entries` (exercise entries)

- `id`, `sessionId`, `orderIndex`
- `exerciseId` text (references `exercises` — a catalog row or a custom owned by the
  program's author; ownership and fork cross-reference rules enforced in core)
- `groupTag` text nullable — entries sharing a tag within a session render as a
  superset/circuit block
- `sets` int; `repsType` enum count/max/seconds; `repsValue` int nullable (null when `max`)
- `loadType` enum none/kg/percent1rm; `loadValue` real nullable (the load target)
- `intensityType` enum none/rpe/rir; `intensityValue` real nullable (the intensity note)
- `restSeconds` int nullable; `cues` text nullable (tempo incl. "3-1-1" lives here)
- `refUrl` text nullable — the author's own reference link for this entry (round-2 Q17
  decision; restored after review found the plan had dropped it)
- index `(sessionId, orderIndex)`

### `author_slug_history` / `program_slug_history`

- author: `fromSlug` text PK, `userId`, `createdAt` — reserved for a **quarantine window**
  (365 days) after the rename; afterwards claimable by anyone, and claiming deletes the
  row. Keep at most the 3 most recent rows per user (older redirects are dropped).
- program: unique `(userId, fromSlug)`, `programId`, `createdAt` — scoped to the author's
  namespace, so two programs cannot both hold "ppl" in history
- Resolver (pure, testable): path miss → current slugs first, then history; 301 to the
  current target by id (never chained hops; flattened on every rename); redirect only when
  the target is public, not deleted, not hidden — otherwise the "removed" page. Covers the
  composed case: author renamed *and* program renamed (resolve author, then program). A
  token suffix short-circuits all of this: **token-first lookup by the globally unique
  token** — rename-proof and claim-proof; the path is used only to build the canonical
  target. All history redirects are 301 with `Cache-Control: max-age=86400`: browsers
  heuristically cache 301s forever, and rename-backs (A→B→A) would otherwise loop for the
  cache's lifetime — one day bounds it. The `/u/{author}/p/{programId}` permalink is the
  degenerate case: the *id* is the key and the author prefix is decorative — **id-first
  resolution**, exactly like token-first, so stale prefixes (rename, even claim) resolve
  forever; it never redirects, so it never breaks. The literal `p` marker segment keeps it
  unambiguous from `{slug}/{token}` shapes. (Research deferred this; adopted anyway: the
  deferred cost was code, the accruing cost is broken links — ids are non-enumerable text,
  zero schema change. Scoped under `/u/` so one rule holds: *all* public program URLs
  live under `/u/`, with key-first trailing resolution — token → id → history → slug.)

### `program_reports`

- `id`, `programId` nullable, `reportedUserId` nullable (profile reports), `reporterUserId`
  nullable (logged-in reporters, else null), `reason` text, `createdAt`, `handledAt` nullable

## Server layer (AGENTS.md rules: thin fns, pure core)

```
src/lib/programs/taxonomy.ts       MUSCLES + MUSCLE_GROUPS map, EQUIPMENT, goal/level enums
src/lib/programs/slug.ts           slug validation (kebab, 3–40, reserved list), suggest
src/lib/programs/program-shape.ts  entry/session/program zod schemas + pure validation
                                   (incl. weeks vs max session weekNumber consistency)
src/server/programs.core.ts        visibility-transition table (incl. token-mint and
                                   slug-retention side effects), fork snapshot builder,
                                   fork authorization rules, redirect resolver, rename
                                   cooldown + quarantine rules, ownership checks, revision
                                   check — pure, DB-free
src/server/programs.fns.ts         createProgram, updateProgramMeta, upsertSession
                                   (whole-session payload, not per-row), removeSession,
                                   upsertCustomExercise, setVisibility, rotateShareToken,
                                   renameAuthorSlug, renameProgramSlug, forkProgram,
                                   deleteProgram (soft), reportProgram — zod in,
                                   requireUser, DB I/O, DTO out
```

kg/lb rendering reuses `src/lib/units.ts` (`fmtWeight`) — no programs copy.
`forkProgram(programId, shareToken?)`: allowed only for public programs or with a valid
token; core rejects drafts, hidden, deleted, and `forkable: false`.

`user.plan` untouched — nothing here is Pro-gated (decision Q19a). New `AppErrorCode`s
(match the SCREAMING_SNAKE union in `src/lib/app-error.ts`): `PROGRAM_NOT_FOUND`,
`NOT_AUTHOR`, `SLUG_TAKEN`, `INVALID_TRANSITION`, `INVALID_ENTRY`, `STALE_REVISION`.

## Routes and pages

| route | auth | what |
|---|---|---|
| `/programs` | yes | my library: drafts, unlisted (share link + replace), public; fork attribution shown |
| `/programs/$programId` | yes (author) | editor |
| `/u/$authorSlug` | no | profile: display name, bio, avatar, public programs; hidden profile → "unavailable" |
| `/u/$authorSlug/$programSlug` | no | public program view; renders only if public **and** not deleted/hidden; deleted → "removed by author" page; redirects via slug history |
| `/u/$authorSlug/$programSlug/$shareToken` | no | unlisted view (token suffix); `noindex`; bare URL while unlisted → 404; public + token → 301 to bare canonical; deleted → "removed" page |
| `/u/$authorSlug/p/$programId` | no | stable ID permalink (Reddit model): id-first resolution — author prefix decorative, survives renames/claims; renders 200, never redirects, never breaks; public + not deleted/hidden only; draft/unlisted → 404 (no token bypass); `rel=canonical` → current `/u/…` URL; excluded from sitemap; QR/print-safe share address |

Shared renderer `components/programs/program-view.tsx` (used by both public and unlisted
views; fork button "Copy to my programs" — anonymous users get sign-in redirect). Editor
`components/programs/program-editor.tsx` + `exercise-picker.tsx` (search, region → muscle
filters, equipment filters, custom-exercise creation inline).

Editor UX shape (mobile-first, autosave debounced):
week tabs → session list → entry rows. Entry row: exercise name (opens picker), sets × reps
(reps picker: number / max / seconds), load target (kg / %1RM), intensity (RPE / RIR),
rest, group toggle ("superset with previous"), cues textarea. Session header: week number,
title, notes. Program settings: meta + tags + visibility controls; going public for the
first time opens the profile setup (author slug + display name). Saves send whole sessions
with the program's `revision`; a stale revision surfaces a reload prompt. A "copy week"
affordance is required — 12-week programs are authored once, then cloned forward.

## Catalog import pipeline (ADR 0001)

`scripts/import-exercises.ts` — one-off, not a runtime dependency:

1. **License gate:** verify wger *data* license (software is AGPL; data license is separate)
   before any import. Document the finding in the script header. Fallback if unclear:
   hand-curated ~150 top lifts (barbell/dumbbell/machine staples across all regions).
2. Transform: wger export → canonical rows via an inline muscle-mapping table
   (wger's coarse taxonomy → `MUSCLES`, coarse → canonical default muscle); dedupe on
   normalized name; our UUIDs.
3. Curated overlay `scripts/catalog-overrides.tsv`: video/article assets, aliases, form
   notes for the top lifts (the ones a picker must not embarrass us on).
4. Output: a **committed seed artifact** (`scripts/exercise-catalog.json` — exercises plus
   their assets, fixed IDs, identical across environments; re-runs are idempotent upserts
   on the normalized-name merge key for exercises and `(exerciseId, url)` for assets),
   applied to local D1 in dev and to prod via `wrangler d1 execute` (documented in the
   script header). Plus a count/quality report (muscle coverage, asset coverage).

Muscle graphics: if an open-license SVG muscle map verifies clean, adopt for the picker;
otherwise Phase 1 ships with muscle-group labels only (no placeholder art). Verify before
build, don't block on it.

## Moderation (decision Q18a)

Report link on program views and profiles → `program_reports` row (light per-IP/day cap on
anonymous reports). Review = SQL query. Platform hide = set `hiddenAt` (programs) /
`profileHiddenAt` (profiles) — core refuses visibility changes on hidden programs, so the
author cannot un-hide. Hard purge path (moderation-only delete) exists per Q15 — Phase 1
implements it as a manual script, not UI. Impersonation (famous names/brands) is handled by
reports: platform force-rename (bypasses the cooldown, clears history) or profile hide.
Known limitation accepted: fork attribution
labels freeze the author display name at fork time (renames/erasure do not propagate).

## SEO

- There is no dynamic sitemap today (`public/sitemap.xml` is static; `src/lib/seo.ts` has
  no sitemap helpers). Add a server-rendered `/sitemap.xml` route: static routes + a D1
  query for public non-deleted programs with slugs and authors with slugs. `robots.txt`
  must NOT disallow token-suffixed URLs — the noindex meta needs crawling to be respected.
- Title pattern "{program} · {author} — physlane"; `seoHead` requires an image — use the
  existing default OG asset (Phase 1 has no covers).
- Token-suffixed (unlisted) URLs, drafts, removed pages: `noindex`, excluded from sitemap.
- Unknown program paths render a plain 404 that *suggests* the author's public programs —
  no heuristic redirects (guess-404 rejected; see `plans/link-recovery-research.md`).
- `/u/…/p/{id}` permalinks: `rel=canonical` → current `/u/…` URL, excluded from sitemap, no
  `noindex` (a noindexed page's canonical is ignored).
- No program structured data in Phase 1 (add with marketplace-era polish).

## UX defaults adopted from the sketch round (2026-10-25)

Resolutions of `plans/programs-ux-sketches/design-notes.md` §5 (all 14 resolved; Q1–Q2 by
user decision 2026-10-25):

- **Q1 — fork intent survives sign-up (user decision).** Copy-initiated sign-ups defer
  the TDEE onboarding wizard: `sign-in` gains a return-URL param; after account creation
  the visitor lands directly in the forked program (born draft, editor). The onboarding
  wizard runs on their first dashboard visit. PRODUCT.md updated.

- **Q2 — vocabulary (user decision): sketch terms ship.** "Share link" (not "private
  link"), "Replace link" (not "Rotate"), CTA "Copy to my programs" stays; CONTEXT.md
  records the Fork avoid-alias exception. Internal names (`rotateShareToken`, rotation in
  core/tests) keep engineering vocabulary.
- Moderation-hidden program page uses neutral copy "This program isn't available" — distinct
  from author deletion's "removed by its author". Hidden programs stay visible to their
  author in library/editor with a "hidden by physlane" state (core already refuses
  visibility changes); Phase-1 appeal = support email.
- Profiles persist once created; de-listing every program leaves an empty "no public
  programs" state (no re-404).
- First profile-setup slug edit is part of the free first mint; the 90-day rename cooldown
  starts after profile setup completes.
- Region summary counts sets by primary muscle only; secondaries don't count.
- Picker defaults: new entry 3 × 10, row opens expanded, single-select per open.
- Editor offline indicator says "changes not saved" (no offline buffering exists in plan).
- Copy week into a non-empty week = confirm-gated destructive replace.
- First video is click-to-load (no third-party request until tap); non-YouTube hosts fall
  back to a plain link.
- App nav gains "Programs" alongside Dashboard / Intake / Cycles.
- No owner self-duplicate CTA (not in plan); library/profile sort = updated-desc;
  empty authored weeks render as "(no sessions)".

Token follow-ups found in shipped code (not sketch scope): dark-mode destructive button
  contrast fails AA in `src/components/ui/button.tsx`; no overlay/scrim token —
  `sheet.tsx`/`dialog.tsx` hardcode `bg-black/50` (DESIGN.md §12 should gain `--overlay`).

## Build order with done-criteria

| # | milestone | done when |
|---|---|---|
| M1 | schema + migration + `src/lib/programs/*` enums/slug/shape with tests | `pnpm db:generate` clean; unit tests for slug rules, entry validation pass |
| M2 | catalog import | `exercises` + `exercise_assets` seeded (wger-verified or curated fallback, ≥150 rows, video asset on the top-50 lifts); picker-quality report reviewed; license finding documented |
| M3 | authoring core + editor | author can build a full program (supersets, load target + intensity, cues, per-entry reference links, custom exercises) and it round-trips through D1 |
| M4 | sharing + visibility | public page renders anonymously; unlisted via `/u/…/{token}` with noindex; stable `/u/…/p/{id}` permalink renders public programs (unlisted/draft → 404, no token bypass); rotation revokes; transitions (incl. slug mint at first share) enforced in core with tests |
| M5 | profiles + slugs + redirects | profile created on first go-public; rename produces working 301; composed-rename and reclaim history tests pass |
| M6 | forks + report + soft-delete + polish | fork copies with attribution label; report row lands; deleted program shows "removed" page; DESIGN.md token pass; PRODUCT.md gains the Programs surface entry; full done gate (`pnpm` format check, lint, typecheck, test, build) green |

M3–M6 are independent enough to parallelize across editors once M1/M2 land.

## Testing (per AGENTS.md / test-audit)

Pure logic only, co-located `__tests__`: slug validation + reserved list; visibility
transition table incl. token-mint-on-enter-unlisted and slug retention; fork snapshot
builder (attribution label, fork-of-fork, draft birth) and fork authorization rules
(public/token-only, `forkable`, hidden/deleted); redirect resolver (current, historic,
token-first short-circuit, flattened chains, composed author+program renames, non-public
targets, quarantine expiry,
claim-deletes-redirect, rename cooldown, id-permalink gates (public 200, unlisted/draft
404 — no token bypass)); entry validation
(exercise ownership incl. fork cross-references, reps/load combos, weeks vs weekNumber);
revision conflicts; taxonomy completeness (every muscle maps to a region). No route-level
DOM tests in Phase 1.

## Phase 2/3 appendix (direction, not design)

- **Phase 2 — Runs + workout logs:** `run` table (programId = owned/forked program,
  startedAt, status); workout logs denormalize entry content at log time (ADR 0002);
  "Start program" button = implicit fork + run. TDEE synergy: training load vs measured
  expenditure computed run-scoped.
- **Phase 3 — paid access + coaching — OPEN DESIGN QUESTION (found in plan review):**
  `forkable: false` + implicit-fork runs means paid programs could never be started, and
  snapshot runs would never deliver the live edits a subscription implies. Candidate
  resolution: a fourth visibility class (access-gated) whose runs attach *through an access
  grant* (no fork) and read the original's current content for not-yet-performed sessions,
  denormalizing at log time. Deciding this is the first act of Phase 3; until then nothing
  in Phase 1 may assume runs require forks (see the ADR 0002 amendment).
- **Phase 3 money model:** no escrow — Stripe Connect-style, platform fee, author payouts,
  **subscription only** (never one-time — Q15 live-edits alignment); coaching = author
  visibility scoped to a trainee's Run, never their account. Requires ToS/marketplace-policy
  work before build. Accepted edge: forks made while a program is free survive a later
  paywall.
