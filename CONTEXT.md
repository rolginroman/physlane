# Physlane

Physlane measures what the body does with energy: adaptive TDEE from the user's own weight and
intake series — "calorie apps guess, this one measures." This file is the canonical language of
the physlane domain. Code, docs, and product copy must use these terms and none of their
_Avoid_ aliases.

## Language

### Tracking core

**Measurement**:
One row of body data logged at a point in time: weight and optional girths.
_Avoid_: weigh-in, check-in

**Cycle**:
A cut, bulk, or maintain phase with a target rate. One active cycle per user.
_Avoid_: cut cycle, diet phase

**Phase**:
Which of cut / bulk / maintain a cycle is in.
_Avoid_: mode, goal state

**Daily intake**:
A user's single kcal number (optional protein) for one calendar day.
_Avoid_: food log, meal

**Progress card**:
The public read-only view of a user's progress, opened by a rotating token.
_Avoid_: public profile, share page

### Billing

**Plan**:
A user's billing state: free or pro. Never used for training content.
_Avoid_: tier, membership

**Pro**:
Physlane's own subscription.
_Avoid_: premium

### Programs

**Program**:
A reusable training prescription: weeks of sessions with per-exercise cues, authored on
Physlane. Authors may share it publicly or by link.
_Avoid_: plan, routine, template

**Session**:
One prescribed workout inside a program.
_Avoid_: day, workout

**Exercise**:
A global catalog entry describing a movement, tagged with detailed muscles (primary and
secondary) that roll up into body regions.
_Avoid_: move, lift

**Asset**:
A linked external resource on a catalog exercise — video, article, or image. Physlane links
or embeds; it never hosts the media.
_Avoid_: media, attachment, resource

**Exercise entry**:
An exercise placed into a session, with sets, reps, optional load target, rest, and cue text.
_Avoid_: slot, block

**Custom exercise**:
An author-defined exercise that is not part of the global catalog.
_Avoid_: private exercise

**Author**:
The user who created a program. Any user can author; "trainer" is a marketing word, not a role.
_Avoid_: trainer, coach, owner

**Trainee**:
A user who opens or follows a program.
_Avoid_: follower, client, athlete

**Access**:
A trainee's right to open a program, granted by a share link (or, later, purchase).
_Avoid_: subscription, membership

**Share link**:
A rotatable possession-grant URL that opens one program.
_Avoid_: invite

**Public**:
Program visibility: listed on the author's profile and indexable by search engines.
_Avoid_: published, listed

**Unlisted**:
Program visibility: openable by anyone with the link, absent from the profile, excluded from
search engines.
_Avoid_: private, hidden, secret

**Draft**:
Program state visible to its author only.
_Avoid_: unpublished, private

**Profile**:
An author's public page at their slug, listing public programs. Created when the author
first makes a program public.
_Avoid_: trainer page, account page

**Author slug**:
An author's chosen unique public identifier. A renamed slug redirects to the new one and
is protected by a quarantine window; afterwards another author may claim it.
_Avoid_: username, handle

**Program slug**:
A program's public identifier, unique within its author's programs. Retained across
visibility changes; renaming keeps the old slug reserved within the author's programs.
_Avoid_: program handle

**Fork**:
A snapshot copy of a program into a user's own programs, carrying attribution to its source.
Forks never sync with the original.
_Avoid_: clone, linked program. (_copy_ is allowed in one place: the viewer CTA reads
"Copy to my programs" — confirmed 2026-10-25)

**Run**:
A trainee's dated execution of a program they own or forked; produces workout logs. Phase 2.
_Avoid_: instance, enrollment, active program

**Workout log**:
A trainee's record of performing a session. Phase 2 — the term is reserved now so phase-1
modeling never collides with it.
_Avoid_: entry, record, logged workout
