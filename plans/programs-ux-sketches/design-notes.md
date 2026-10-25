# Shareable programs — design notes (Phase 1 UX sketches)

Companion to the static sketches in this folder. Contract: `plans/programs-design-brief.md`.
Sources read: `DESIGN.md`, `PRODUCT.md`, `CONTEXT.md`, `plans/shareable-programs-plan.md`,
`src/styles.css`, `src/components/ui/{button,dialog,sheet}.tsx`, `src/components/header.tsx`,
`src/routes/sign-in.tsx`, `src/routes/share.$token.tsx`.

How to view: serve the repo root over HTTP (e.g. `python3 -m http.server` from the repo root) and
open `/plans/programs-ux-sketches/index.html`. The sketches load the self-hosted fonts from
`public/fonts/` by relative path. Each page has a light/dark toggle, persisted in
`localStorage`. Each frame uses one markup; container queries switch the 390px mobile
layout to the 1280px desktop layout. In the product this becomes ordinary media queries.

Vocabulary decisions that differ from the brief (the brief says the repo wins on conflicts):

| Brief says | Sketches say | Why |
|---|---|---|
| "Private link" (viewer banner), "Create private link" (button) | "Opened with a share link. This program isn't listed publicly." / "Create share link" | CONTEXT.md lists *private* as an _Avoid_ alias of both Unlisted and Draft; **Share link** is the canonical term. The brief sets "Private link" as a ceiling ("at most"), not a requirement. See Q2. |
| "Rotate" / "Rotate link" | "Replace link…" (author screens only) | Rotate is allowed on author screens, but the B4 friction is jargon. "Replace" states the outcome. The confirm copy names the consequence. |
| "Copy to my programs" | kept verbatim | The plan and brief both fix this button label. CONTEXT.md lists *copy* as an _Avoid_ alias of **Fork**, but the label is a verb phrase, not the noun. Flagged as Q2. |
| "Day 1 — Push", "days/week" | Session titles are author free text ("Upper A", "Push"); chips read "4 sessions / week" | CONTEXT.md: Session, _Avoid_ "day, workout". The data field stays `daysPerWeek`; only the label changes. |
| "Your copy is a draft…" on viewer screens | "Only you can see your copy until you share it." | Author vocabulary (draft) must not leak to viewers (§3 invariant). |

---

## 1. CJM → screen traceability

| Stage | Answered in | How |
|---|---|---|
| A1 Arrive | `program-view` §1, `program-view-unlisted` §1 | Full content renders with no account, no interstitial, and no cookie wall drawn. Unlisted adds only a one-line banner. |
| A2 Orient (5 s) | `program-view` §1 hero | The above-the-fold order answers the 5-second questions: title, "by Tara", chips (goal, level, sessions per week, weeks), equipment line, short description. Minimal programs still answer A2 from the chips alone (§6). |
| A3 Evaluate (emotion dip) | `program-view` §1 | The week reads as a list. Sessions start collapsed with "8 exercises · 26 sets" summaries and the first session open. Entry cards show prescription on one line (sets × reps, load, RPE/RIR, rest). Supersets get a bracket, a "Superset" label and an instruction. Each open session shows a sets-by-region bar summary. |
| A4 Verify depth | `program-view` §2 | "Video"/"Link" hints show which exercises open something useful. The drawer (sheet on mobile, panel on desktop) shows catalog muscles and equipment, then the first video (click to load), the form note, "From Tara" (prescription, cues, refUrl) and References. With no assets it shows one plain notice, not a dead end. |
| A5 Trust author | `program-view` §1 author block / desktop aside → `profile` | The author link appears only on public views. Unlisted views show plain text (no profile exists for unlisted-only authors). The profile shows name, bio and program cards, with graceful no-programs and hidden states. |
| A6 Act | `program-view` §3, §4 | Anonymous: the copy button opens a sheet explaining what an account is for, offering Create account / Sign in / Keep reading. After auth the visitor returns to the same URL with a pinned one-tap prompt. Signed-in: one tap, with loading and failure states. `forkable: false` removes the button (§6). |
| A7 Land after fork | `fork-confirmation`, `editor` §5 | The visitor lands in their own editor with a one-time banner (draft, only you, no sync with the original). A permanent "Based on Tara · Hypertrophy Base" line sits under the title. The library row is highlighted. |
| B1 Start | `library` §3 | The new-program sheet asks for title, goal, level and sessions per week only. Weeks start at 1. Everything else lives in program settings. |
| B2 Structure | `exercise-picker` §1–2, `editor` §1 | Search first. Region → muscle and equipment filters narrow results; they never gate. Asset hints on results. A miss becomes "Create '{query}'", with the custom form requiring a primary muscle. |
| B3 Enrich (optional) | `editor` §1, §4 | Every optional field says "(optional)". Autosave indicator. Sharing is never blocked by missing fields. |
| B4 Share (moment of truth) | `share-dialog` §1 | In Draft the preselected answer is Unlisted, so the primary button is already "Create share link". Three taps: Share → Create share link → Copy. URL, copy, QR and plain-language lines per state. No profile setup at this point. |
| B5 Go public later | `share-dialog` §2–3, `profile-setup` | The first go-public inserts a 2-step profile setup (prefilled name and address, optional bio), then a confirm, then a "what changed" list with the public URL and the QR/print permalink. |
| C1 Extend | `editor` §1–2 | "Copy week" sits beside the week heading on every week. The target defaults to the next week. Replacing a non-empty week is labelled and the button turns destructive. A toast offers "Go to week 5". |
| C2 Edit live (anxiety) | `editor` §1, §3 | Public programs carry a one-line note: changes go live as they save, and addresses and links don't change. A stale revision pins a banner, pauses autosave, keeps the unsaved session visible, and offers Reload plus "Copy my change". |
| C3 Rotate access | `program-view-unlisted` §2, `share-dialog` §2, `library` row | "Replace link…" sits in the owner bar, the dialog and library rows. The alertdialog says who loses access. After replacement the address bar updates to the new URL. |
| C4 De-list | `share-dialog` §4 | Public→Draft and Public→Unlisted are both confirm-gated. Each lists exactly which addresses die and that the slug is kept. Unlisted→Draft is also confirmed (the link dies). |
| C5 Check presence | `program-view` §5, `program-view-unlisted` §2, `profile` §1 | The owner bar (Edit / Share) appears on their own public page. Owner link controls appear on their own share link. Profile shows an owner shortcut. Report link and copy CTA are hidden from owners. |

Cross-journey invariants checked: content is readable without login on every viewer screen.
Every destructive or irreversible action (replace link, move to draft, make unlisted, delete
program, replace week) has one consequence sentence or list before it commits. Viewer
screens never show draft / unlisted / token / rotate / revision. Owner affordances
appear only in owner frames.

## 2. State-matrix coverage

Legend: **D** = drawn frame. **S** = same layout, swapped region (described in the file's
section note). **n/a** = cannot occur, with the reason.

| State | program-view | program-view-unlisted | share-dialog | library | editor | exercise-picker |
|---|---|---|---|---|---|---|
| Populated | D (m + d) | D (m + d) | D (m + d) | D (m + d) | D (m + d) | D (m + d) |
| Empty | D empty week (§7) | S → program-view §7 | n/a: Draft is the empty state (D §1) | D (§3) | D empty program, empty session (§5) | D no results, empty My exercises (§2) |
| Loading skeleton | D (§7) | S | D pending action (§5) | D (§4) | D (§5) | D (§3) |
| Error | D page error, copy failure toast (§4, §7) | S | D transition error, moderation-hidden (§5) | D (§4) | D load error, save error, stale revision, entry validation (§3, §5) | D (§3), D validation (§2) |
| Anonymous vs signed-in | D anonymous (§1), sign-in prompt sheet + return (§3), signed-in (§4) | D anonymous (§1), D signed-in (§3) | n/a: author-only | n/a: auth route → sign-in | n/a: auth route; a non-author gets a plain 404 | n/a: author-only |
| Owner viewing | D (§5, m + d) | D owner bar, replace confirm, replaced (§2, m + d) | always owner | always owner | always owner | always owner |
| Long content | D 12 weeks, 8-entry session, 2- and 3-exercise supersets (§1) | D (§1 reuses it) | D long URL truncation (§5) | D 5 rows, mixed states (§1) | D 12 weeks, 8 entries, two superset chains (§1) | D long result list; S virtualised scroll (§3) |
| Minimal content | D Leo: no description, 1 week (no tabs), no rest/intensity/cues/assets (§6); D drawer with no assets (§2) | S | n/a | D one draft (§3) | D minimal rows (§5) | S full catalog A–Z with no filters (§3) |

Extra states drawn: unit preference (lb) in program-view §4; public-fork attribution and
`forkable: false` in program-view §6; report sheet in §7; delete confirm in library §2;
copy-week replace in editor §2; button state reference sheet (default, hover, active, focus,
disabled, loading) in program-view §4.

P1 (mobile first; desktop frame where useful): `profile` (visitor, owner, no public
programs, minimal, hidden, loading, desktop), `profile-setup` (default, checking, taken
with suggestions, invalid, reserved, empty name, saving/failed, rename allowed, cooldown),
`program-not-found` (author resolves with suggestions, unknown author, signed-in, desktop),
`program-removed` (with and without profile, proposed moderation-hide variant),
`fork-confirmation` (editor landing, library highlight, desktop).

## 3. Token usage and gaps

Each sketch defines the DESIGN.md v2 palette under the shadcn-canonical names, in light
(`:root`) and dark (`html[data-theme="dark"]`) blocks, mirroring `src/styles.css`. Every
hex value in every file is inside those two blocks (18 + 18; checked by grep).

| Token | Used for |
|---|---|
| `--background` | page and screen canvas |
| `--card` | entry cards, session cards, program cards, chips |
| `--muted` | inputs, banners, owner bar, skeletons, notices |
| `--popover` | sheets, dialogs, side panels, menus, picker |
| `--foreground` | headings, primary text; toast background (inverted) |
| `--text-secondary` | body and description text, prescription line |
| `--muted-foreground` | captions, metadata, section labels (light value is the Appendix A `#6B6964`) |
| `--border` | dividers, card and input outlines (decorative only, never meaning-bearing) |
| `--primary` / `--primary-foreground` | primary buttons (dark label = `#101112` per Appendix A), selected tab underline, selected radio, play button |
| `--brand-hover` | primary hover and active |
| `--brand-soft` | selected filter chips, confirmation banners, search-match highlight, new-row highlight |
| `--brand-text` | small red text: links, Public badge (Appendix A: small red text uses the hover red) |
| `--destructive` | destructive buttons, field errors, error notices |
| `--chart-grid` / `--chart-neutral` | region bar track and fill; superset bracket; Unlisted badge border |
| `--data-positive` | "Available" slug state, "Report sent" check. Always paired with an icon and a word, never colour alone. |
| `--ring` | 2px focus outline, drawn on at least one control per screen |

Typography: Instrument Serif for page titles only (program title, profile name, page
headings). Inter for everything else. Tabular numerals for prescriptions and counts.
Radius 12 (cards) / 8 (controls). 44px minimum targets on interactive controls (buttons,
chips, tabs, rows, list links).

Gaps found (none invented as product tokens):

1. **No overlay/scrim token.** Shipped code uses raw `bg-black/50` (`src/components/ui/sheet.tsx`)
   and `bg-black/10` (`dialog.tsx`). The sketches define a clearly labelled `--sketch-scrim`
   that mirrors the shipped sheet value, so the gap stays visible. Recommendation: add a
   documented `--overlay` with per-theme values to DESIGN.md §3.
2. **Dark-mode destructive button fails contrast in shipped code.** `src/components/ui/button.tsx`
   uses `bg-destructive text-white`. In dark, `--destructive` is `#f04a42`. White on
   `#f04a42` is 3.64:1 (DESIGN.md Appendix A, same value as dark `brand-hover`), which is
   below AA. The sketches use `--primary-foreground` (`#101112`, 5.19:1) as the destructive
   label in both themes. Light: `#fffefc` on `#b92520` is about 5.7:1. Recommendation:
   change the destructive variant label to `text-primary-foreground`.
3. **Name mismatch between brief and code.** The brief lists `--text-secondary`,
   `--brand-hover` and `--brand-soft` as bare custom properties. In `src/styles.css` they
   exist only as Tailwind theme variables (`--color-text-secondary`, `--color-brand-hover`,
   `--color-brand-soft`, plus `--color-brand-text`). Same values; implementers should use
   the utility classes (`text-text-secondary`, `bg-brand-soft`, …).
4. **No warning/caution token.** Stale-revision, moderation and "replaces 4 sessions"
   notices use `--muted` and `--brand-soft` with an alert icon and words. No new colour is
   needed. Recorded so nobody adds an amber.
5. **QR rendering on dark.** The QR placeholder inverts in dark (foreground tile) because a
   dark-on-dark code scans poorly. This uses no new token, only a per-theme rule.

## 4. Intended motion

All transitions follow DESIGN.md §9.2 and reuse shipped durations where they exist.

| Element | Transition | Source/duration |
|---|---|---|
| Bottom sheet (mobile drawer, share, report, new program, copy week) | translateY 2.5rem + opacity, ease-in-out | `sheet.tsx`, 200ms; scrim fade 150ms |
| Side panel (desktop drawer, settings) | translateX 2.5rem + opacity | `sheet.tsx` side variants, 200ms |
| Centered dialog (desktop share, confirms) | fade + zoom from 95% | `dialog.tsx`, 100ms |
| Primary/secondary button | background colour | `.btn-primary`, 150ms ease-out |
| Session accordion | chevron rotate; body height reveal | 200ms ease-out (matches `.faq-marker`) |
| Week tab change | underline moves; panel swap with no slide | instant panel; underline 150ms |
| Share-dialog answer change | action panel cross-fade | 150ms |
| Copy → "Copied" | label swap, held about 2 s, announced via `aria-live` | no animation |
| Toasts | fade + 8px rise in; fade out after about 4 s (errors persist until dismissed) | 150ms |
| New library row after copy | `--brand-soft` background fades to none | about 1.5 s, once |
| Skeletons | opacity pulse 1.0 → 0.6 | 1.2 s loop, stops when content arrives |

Reduced motion: shipped `src/styles.css` already clamps durations under
`prefers-reduced-motion: reduce`. Under it, sheets and dialogs appear in place, skeletons
are static, and the row highlight shows without fading. No content depends on animation.

Focus: opening a sheet or dialog moves focus to its first control or Close (drawn with
`--ring`). Closing returns focus to the trigger. Alertdialogs focus the destructive
action's Cancel by default in the product. The sketches draw focus on the action to show
the ring.

## 5. Open questions / decisions not made from the repo

1. **Does copy intent survive sign-up's onboarding wizard?** PRODUCT.md says new sign-ups
   go through the TDEE onboarding wizard (J1). A visitor who taps "Copy to my programs" and
   creates an account may never return to the program. Also, `src/routes/sign-in.tsx` has
   no generic return-URL parameter (only the OAuth continuation). The sketch assumes a
   return URL plus a pinned one-tap prompt (`program-view` §3). Decide: skip or defer
   onboarding for copy-initiated sign-ups, or return after onboarding.
2. **Vocabulary conflicts between the brief and CONTEXT.md.** The sketches use "share link"
   instead of "private link" and "Replace link" instead of "Rotate". They keep the plan's
   "Copy to my programs" despite *copy* being a Fork _Avoid_ alias. Confirm, or amend
   CONTEXT.md.
3. **Profile after the last de-list.** The plan creates the profile at first go-public and
   404s `/u/{slug}` before that. It does not say what happens when every program is later
   de-listed. The sketch draws "no public programs right now" (the brief requires this
   state). The alternative is a 404 again.
4. **Moderation-hidden program page copy.** The plan routes hidden programs to the
   "removed" page, but "removed by its author" is false for a moderation hide. Proposed
   neutral variant: "This program isn't available". Also undecided: does the author still
   see and edit a hidden program in the library and editor, and is there any appeal or
   contact path?
5. **Author slug edit at first go-public.** The slug is minted silently at first share
   (unlisted). If the author edits it in profile-setup, is that the free first mint or a
   rename that starts the 90-day cooldown and writes history?
6. **Region summary counting rule.** The sketch counts sets by the region of the primary
   muscle only. Should secondary muscles count (fractionally or fully)? Should a
   week-level summary exist as well as per session?
7. **Picker defaults.** Proposed: a new entry is created as 3 × 10 with the row opened
   expanded. Single-select per open. Multi-add would shorten Leo's 6-entry path; not
   drawn, decide later.
8. **Offline buffering.** The editor indicator "Offline · changes kept on this device"
   assumes local buffering, which the plan does not include. The alternative copy is
   "Offline · changes not saved".
9. **Copy week into a non-empty week.** The sketch allows replacing with an explicit
   destructive label. Should replacement be allowed at all, or only empty or new weeks as
   targets?
10. **Embeds and privacy.** The first video is click-to-load (no third-party request until
    tap). Confirm, and decide whether non-YouTube video hosts embed or fall back to a link.
11. **Nav placement.** `src/components/header.tsx` app nav has Dashboard / Intake / Cycles.
    The sketches add "Programs" as a fourth item; the plan does not specify it.
12. **Owner copying their own program.** The sketches hide the copy CTA for owners. A
    "duplicate my program" action is not in the plan, so none is drawn.
13. **Sort orders.** Library and profile are sorted by most recently updated. This is an
    assumption.
14. **Weeks count vs authored weeks.** The plan stores `weeks` and validates it against the
    maximum `weekNumber`. The sketch derives weeks from the tabs (Add week) and shows an
    "empty week" viewer state. Confirm empty weeks are valid on a public program.
15. **Unit display for anonymous viewers.** The default is kg (brief). Is there any
    anonymous toggle? None is drawn.

## Self-check (§10)

- Every P0 screen has every state-matrix row as D, S or n/a with a reason (table §2).
- No invented features: no logging, comments, ratings, paywall, social feed,
  notifications, view or follower counts, or cover images.
- Both themes on every page; tokens only (hex confined to token blocks); focus ring drawn
  per screen; 44px targets on interactive controls.
- Viewer frames contain no draft / unlisted / token / rotate / revision. Owner bars,
  link controls and Edit appear only in owner frames. The report link is hidden from
  owners.
- Sections 1–5 above are complete.
