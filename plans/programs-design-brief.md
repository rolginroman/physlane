# Design brief: Shareable training programs — UX sketches (Phase 1)

You are a senior product/UX designer. Produce **static HTML wireframe sketches** for the
Phase-1 "shareable training programs" feature of physlane. This brief is your contract:
personas → customer journey maps → screens → states → constraints → deliverables. Where
this brief and the repo disagree, the repo wins; where you are unsure, leave an explicit
open question in `design-notes.md` instead of inventing.

## 0. Required reading (in this order)

1. `plans/programs-design-brief.md` — this file.
2. `DESIGN.md` — the design language v2. Visual authority. Tokens, typography,
   illustration rules, responsive rules, buttons, motion, accessibility.
3. `PRODUCT.md` — product truth: users, tone, anti-references. Do not invent tone.
4. `CONTEXT.md` — domain glossary (Program, Session, Entry, Author, Trainee, Fork, …).
   Use these words in UI copy exactly.
5. `plans/shareable-programs-plan.md` — the engineering plan: routes, data model,
   visibility state machine, editor shape, moderation, SEO. Sections "Routes and pages",
   "Resolved details worth restating", "Moderation".

## 1. Product context (2 paragraphs, read once)

physlane is an adaptive-TDEE web app (Cloudflare Workers, server-rendered, mobile-first).
Its existing users (PRODUCT.md J1 "Cutter", J2 "Bulker") log weight and intake daily and get
an adaptive TDEE estimate. Tone: precise, calm, nonjudgmental, zero hype.

Phase 1 adds **shareable training programs**: any registered user authors structured
programs (weeks → sessions → exercise entries) from an exercise catalog (muscle taxonomy,
video/article assets), shares them via unlisted token links or public profile pages, and
anyone can view or fork them. **There is no workout logging, no comments, no ratings, no
social feed, no paywall, no Pro gating anywhere in this feature.** Do not draw any of it.

## 2. Personas

The two authoring personas are existing physlane users; the visitor persona is new
top-of-funnel (a shared link is now a discovery surface).

- **Tara — trainer-author.** Coaches 15 clients, lives on her phone between sessions.
  Publishes polished 12-week programs; cares about professional presence (profile page,
  stable shareable links, QR/print for business cards); will later sell access (NOT Phase 1).
- **Leo — casual author (J1 Cutter).** Wants to share his PPL split with one friend and a
  subreddit. Hates setup friction; will never fill optional fields; needs the 3-minute path
  from "new program" to "link copied".
- **Vera — anonymous visitor.** Follows a shared link on her phone (from a chat or Reddit).
  Not a user (yet). Skims, evaluates fit (level/goal/days), maybe opens one exercise's
  video, maybe forks → hits sign-in. The sign-in moment is the bridge into the J1
  onboarding funnel — it must feel like a door, not a wall.

## 3. Customer journey maps

For each journey: stages, what they do / think / feel, friction risks, the design response
you must sketch, and the success signal. The **emotion curve** matters — mark the
low-confidence dips and design the recovery visible.

### Journey A — Vera follows a shared link (cold reader; THE critical journey)

| # | Stage | Doing | Thinking | Feeling | Friction risk | Design response (must sketch) | Success signal |
|---|---|---|---|---|---|---|---|
| A1 | Arrive | Taps link in chat/Reddit, on phone | "Is this spam? Will it make me log in?" | wary | interstitial/login wall, slow render | Public + unlisted views render fully anonymously; content first | bounce < 40% |
| A2 | Orient (5s) | Skims top of page | "Whose program? What goal, what level, how many days/week, how long?" | curious → judged | wall of tables; no summary | Hero: title, author line, tag chips (goal/level/days), weeks count, short description | can answer all 4 in 5s |
| A3 | Evaluate | Opens week 1 / day 1, scans entries | "Is this for me? Are the exercises sane?" | evaluating | jargon, dense grid, tiny targets | Session view: entry cards (name, sets×reps, load, rest), superset grouping visible, muscle-region summary | reaches session 2 |
| A4 | Verify depth | Taps an exercise → asset drawer | "How do I actually do it?" | reassured→ | no assets, dead ends | Asset drawer: first video inline, "References" list (articles/images), catalog description | 1 asset opened |
| A5 | Trust author | Taps author line → profile | "Does this person know things?" | assessing | empty/hidden profile dead-end | Profile: display name, bio, public programs grid; graceful "no public programs" | profile viewed |
| A6 | Act | Taps "Copy to my programs" | "I want this" | decided | sign-up wall feels punitive | Fork → clean sign-in redirect preserving intent; authed → 1-tap fork confirmation (born private copy, attribution shown) | fork initiated |
| A7 | Land after fork | Lands in own library/editor | "Now it's mine to edit" | ownership | disorientation | Fork confirmation state showing attribution label "Based on Tara's Hypertrophy Base" | edits session 1 |

Emotion curve: wary → curious (A2) → **dip if dense** (A3) → reassured (A4) → decided (A6).
Moment of truth: A2→A3 — orient-then-evaluate without scrolling confusion.

### Journey B — Leo creates and shares his first program (3-minute path)

| # | Stage | Doing | Thinking | Feeling | Friction risk | Design response | Success signal |
|---|---|---|---|---|---|---|---|
| B1 | Start | `/programs` → "New program" | "Quick thing for my friend" | casual | blank-page paralysis, too many required fields | New-program sheet: title + goal + level + days/week only; everything else optional/deferred | program created <30s |
| B2 | Structure | Adds sessions, entries via picker | "Bench 3×8, rest 2 min…" | fluent | picker can't find his exercise | Picker: search-first, region→muscle filters, equipment filter, inline custom-exercise creation (same schema, primary muscle required) | 6 entries in |
| B3 | Enrich (optional) | Skips. Or adds one refUrl/notes | "Good enough" | pragmatic | forced completeness | Optional fields visibly optional; autosave with saved-state indicator; never blocks share | — |
| B4 | Share | "Share" → wants a link now | "Just give me the link" | impatient | visibility jargon (draft/unlisted/public), profile setup ambush | Share dialog: default action "Create private link" (unlisted) — one tap, URL + copy + QR; plain-language state explainer | link copied <3 taps |
| B5 | Later: go public | Revisits, makes it public | "Might as well" | mild commitment | profile/slug setup feels like a wall | First go-public opens profile setup (display name defaults sensibly, slug auto-suggested); after save, public URL + "what changed" summary | public URL used |

Emotion curve: casual → fluent (B2) → **dip at jargon** (B4) → done. Moment of truth: B4.

### Journey C — Tara maintains a live program (ongoing authorship)

| # | Stage | Doing | Thinking | Feeling | Friction risk | Design response | Success signal |
|---|---|---|---|---|---|---|---|
| C1 | Extend | Week 5 → copy week 4 forward, tweak | "Same but +2.5kg" | routine | rebuilding 12 weeks by hand | "Copy week" affordance prominent in editor | week cloned <10s |
| C2 | Edit live | Fixes a typo on a public program | "Don't break the link!" | anxious | fear that edits change URL / break shares | Live edits never change URLs; autosave + stale-revision banner ("opened in another tab — reload") with safe recovery | edit w/o fear |
| C3 | Rotate access | Shared unlisted link too widely | "Kill the old link" | protective | irreversible-feeling actions | Rotate control in share dialog with explicit consequence copy ("previous links stop working"), confirm | rotation done confidently |
| C4 | De-list | Takes program back to unlisted/draft | "Off my profile" | deliberate | surprise: public link behavior | Confirm-gated public→draft; copy states exactly what happens (link dies, slug kept for future re-list) | no accidental de-list |
| C5 | Check presence | Views own public page, profile | "Looks professional?" | proud | no owner affordances | Owner viewing own public page: subtle "Edit" shortcut + unlisted banner on token views; report link NOT shown to owner | profile check done |

Emotion curve: routine → **anxiety spike at C2/C3** (irreversibility fear) → confident.
Moment of truth: C2/C3 — mutation clarity (what breaks, what doesn't).

Cross-journey invariants: content readable without login (A), every destructive/irreversible
action shows consequence copy (B4/C3/C4), author vocabulary never leaks to viewers
("draft/unlisted/token/revision" are author-side words — viewers see "Private link" at most).

## 4. Information architecture (routes — fixed, from the plan)

| route | auth | screen |
|---|---|---|
| `/programs` | yes | My programs (library): drafts, unlisted (link + rotate), public; fork attribution shown |
| `/programs/$programId` | yes (author) | Editor |
| `/u/$authorSlug` | no | Public profile: display name, bio, avatar, public programs grid; hidden → "unavailable" |
| `/u/$authorSlug/$programSlug` | no | Public program view (shared renderer) |
| `/u/$authorSlug/$programSlug/$shareToken` | no | Unlisted view: same renderer + "private link" banner (owner: + rotate/edit) |
| `/u/$authorSlug/p/$programId` | no | Stable ID permalink: renders the public view; never shown as canonical — QR/print link |

## 5. Screens to sketch (priority order)

**P0 — sketch all, mobile (390px) first, then desktop (1280px):**
1. `program-view` — the shared renderer (public variant): hero (title, author line, chips:
   goal/level/days-per-week, weeks, description), fork CTA, week navigation, session list,
   entry cards, muscle-region summary, exercise → asset drawer, report link (subtle,
   footer), sign-in-prompt variant of fork CTA for anonymous.
2. `program-view-unlisted` — same + private-link banner; owner variant (edit shortcut,
   rotate).
3. `share-dialog` — the visibility state machine made legible: current state (draft /
   private link / public), primary action per state (create link / copy+QR+rotate / go
   public), consequence copy per transition, confirm-gated public→draft, profile-setup
   step on first go-public.
4. `library` — my programs: list/grid with visibility badges, token-link rows for
   unlisted, fork attribution labels, empty state, "New program" entry.
5. `editor` — week tabs, session list, entry rows (see §6), copy-week affordance,
   autosave/stale-revision states, program settings sheet.
6. `exercise-picker` — dialog: search, region → muscle filter, equipment filter,
   catalog/custom tabs (custom = same schema, primary muscle required), asset hints.

**P1 — sketch mobile only:**
7. `profile` — display name, bio, avatar, public programs grid; "no public programs yet"
   and hidden-profile states.
8. `profile-setup` — first go-public sheet: display name (defaulted), author slug
   (auto-suggested, editable, validation states), bio optional.
9. `program-not-found` — 404 that *suggests* the author's public programs (no redirects).
10. `program-removed` — "removed by author" page (distinct from 404; no content).
11. `fork-confirmation` — 1-tap fork result: born-private copy + attribution label.

**State matrix — every P0 screen needs these variants drawn (or explicitly listed in
design-notes as "same layout, swapped region"):** empty · loading skeleton · error ·
anonymous vs signed-in viewer · owner-viewing · long-content (12 weeks, 8-entry session,
superset chains) · minimal-content (Leo's bare-bones program: empty description, no
assets, no rest/intensity).

## 6. Domain content model (what you are laying out)

- Program: title, description (optional), tags (goal: strength/hypertrophy/fat-loss/general;
  level: beginner/intermediate/advanced; daysPerWeek; equipmentTags), weeks count,
  visibility state, fork attribution (if a fork).
- Session: week n, title (e.g. "Day 1 — Push"), notes (optional), ordered entries.
- Entry card: exercise name (catalog or custom), sets × reps (reps: number | "max" |
  seconds), load target (kg or %1RM), intensity (RPE/RIR, optional), rest (optional),
  superset grouping with previous (visual bracket/chain), cues (optional text),
  refUrl (optional per-entry link).
- Exercise (from catalog): name, muscle (primary + secondaries), region, equipment,
  description, assets — first video embeds inline in the drawer; articles/images list
  under "References". Custom exercises: identical shape, author-scoped.
- Units: viewer sees kg or lb per their preference (default kg); never both.
- Muscle taxonomy: 8 regions → 25 muscles; the region level is the summary granularity.
- Fork: private copy at fork time, never syncs; attribution is plain text
  "Based on {display name} · {program title}"; `forkable: false` programs show no fork CTA.

## 7. Visual system constraints (DESIGN.md is the authority)

- Use the DESIGN.md v2 palettes via their **shadcn-canonical token names**
  (`--background`, `--card`, `--muted`, `--popover`, `--foreground`,
  `--text-secondary`, `--muted-foreground`, `--border`, `--primary`, `--brand-hover`,
  `--brand-soft`, `--ring`, …) with the documented light/dark values. No other colors,
  no raw hex outside the token definitions in each sketch's `<style>`.
- Both themes: ship each P0 sketch in light **and** dark (toggle or duplicate file).
- Typography per DESIGN.md §4 (display font for page titles, interface font for
  everything else); spacing/radius per §6; buttons per §9 (incl. all states).
- Illustration: if any illustration is used, follow §5 (editorial athletic style) —
  otherwise use none. No photos, no glassmorphism, no decorative gradients (§2.2 avoid-list).
- Motion: per §9.2 only; sketches are static but note intended transitions in
  design-notes.md. Reduced-motion respected in the notes.
- Accessibility: visible `--ring` focus states in sketches of interactive elements;
  contrast must pass (Appendix A); touch targets ≥44px on mobile sketches.

## 8. Copy rules (PRODUCT.md is the authority)

- Factual, calm, nonjudgmental. No marketing claims, no superlatives, no emoji, no "🚀".
  State only what the screen actually does.
- Author-side vocabulary (draft, unlisted, token, rotate, revision) stays on author
  screens; viewer screens say "Private link" at most, nothing about mechanics.
- Buttons are verbs: "Copy to my programs", "Create share link", "Replace link", "Copy
  week", "Go public". (Adopted vocabulary 2026-10-25: "Share link" not "private link",
  "Replace link" not "Rotate" — CONTEXT.md/plan record the decisions.) Consequence copy
  under risky actions: one sentence, plain words.
- No fake social proof anywhere: no view counts, no follower counts, no ratings.

## 9. Deliverables

Directory: `plans/programs-ux-sketches/`. All files kebab-case. Static HTML, no build
step, no CDN, no frameworks — inline `<style>` with the token definitions; a little
vanilla JS is fine for demos (e.g. week tab switching, theme toggle).

- One HTML file per screen per breakpoint strategy: mobile-first CSS that also renders
  acceptably at 1280px is preferred over separate files; call out where a desktop
  variant diverges structurally and sketch that divergence in the same file.
- `index.html` — links every sketch, grouped P0/P1, with one-line intent per link.
- `design-notes.md` — required sections: (1) CJM → screen traceability table (each A1–C5
  stage → where it's answered); (2) state-matrix coverage list; (3) token usage notes and
  any token gaps found (do NOT invent tokens — report gaps); (4) intended motion notes;
  (5) open questions / decisions you could not make from the repo.

## 10. Quality gate (self-check before finishing)

- Every P0 screen has all §5 state-matrix variants accounted for.
- No invented features (no logging, comments, ratings, paywall, social, notifications).
- Both themes present for P0; tokens only; focus states drawn; 44px targets.
- Anonymous viewer never sees author vocabulary; owner affordances never shown to
  anonymous viewers.
- design-notes.md sections 1–5 complete.
