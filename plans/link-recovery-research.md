# Link self-recovery after slug, title, and author renames: survey and recommendations for physlane

As of 2026-10-25. Every source below was fetched on that date unless marked otherwise. Statements marked **[unverified]** come from secondary sources or from inference, not from a primary document.

## TL;DR

- **The surveyed systems use two structural primitives, plus one heuristic and one out-of-band layer.**
  1. A **stable key in the URL**: an immutable ID, a content hash, or a persistent identifier.
  2. A **mapping from an old key to the current location**: a redirect table.
  3. **Heuristic inference**: WordPress guess-404.
  4. **Search-layer signal transfer**: canonical tags and Google's Change of Address tool. This layer does not recover anything for users.

  Hugo/Jekyll alias pages, `_redirects` files, PURL/DOI/handle, GitHub/GitLab renames and WordPress `_wp_old_slug` are all primitive 2. They differ only in where the table lives, who writes it, and when rows die. DOI/PURL combine 1 and 2. IPFS is pure 1, and once you add mutable naming (IPNS/DNSLink) you are back to 2.
- **physlane's settled design is primitive 2, applied automatically, with flattening, ending when someone claims the slug.** It matches **GitLab** almost exactly: redirects live "as long as the original path is not claimed". It is stricter than **GitHub**, which frees the old username immediately and 404s the profile at once.
- **Recommendations, ranked:**
  1. **Resolve unlisted URLs by `shareToken` first.** The token is already globally unique. This needs zero new state and makes unlisted links immune to every author and program rename, and to claims.
  2. **Bound how long browsers cache 301s.** RFC 9110 says 301 is "heuristically cacheable". A rename followed by a rename back, which the plan explicitly allows ("re-claiming your own quarantined slug"), can create a browser-cached redirect loop.
  3. **Reconsider the 90-day quarantine.** Google advises keeping redirects "generally at least 1 year". At 90 days, a claim can kill a redirect before Google has moved the signals over.
  4. **Do not add WordPress-style guess-404.** It is a prefix `LIKE` match with no `ORDER BY`, so the result is arbitrary. It also invites soft-404 and SEO problems. If anything, render a 404 page that *suggests* the author's public programs instead of redirecting.
  5. **A Reddit/Discourse-style ID permalink for public programs is optional.** It is low value under the current rate limits. Defer it until 404 data shows that claims are breaking public links.
  6. **Optional: GitHub-style per-path shadowing after a claim.** Keep the history row; let the claimant's real paths win, and let old non-colliding program paths keep redirecting.

---

## 1. WordPress

**Mechanism, verified from core source (trunk, `wordpress-develop`).**

- **Write side.** `wp_check_for_changed_slugs()` is hooked on `post_updated` and `attachment_updated` at priority 12 (`default-filters.php:491-492`).
  - When the slug of a *published, non-hierarchical* post changes, it does `add_post_meta($post_id, '_wp_old_slug', $post_before->post_name)`.
  - If the new slug was in the old list, it deletes it from the list. This is the "rename back" cleanup.
  - So it is automatic: the author does nothing. Pages are hierarchical and are **not** covered.
  - Source: https://developer.wordpress.org/reference/functions/wp_check_for_changed_slugs/
- **Read side, exact match.** `wp_old_slug_redirect()` runs on `template_redirect` (`default-filters.php:490`).
  - It runs only `if ( is_404() && '' !== get_query_var( 'name' ) )`.
  - It calls `_find_post_by_old_slug()`, an exact `meta_value = %s` join on `_wp_old_slug` for the post type. Date query vars narrow it when present. If that fails, it falls back to `_find_post_by_old_date()`.
  - It then issues `wp_redirect( $link, 301 )`. Hierarchical post types are skipped.
  - Source: https://developer.wordpress.org/reference/functions/wp_old_slug_redirect/
- **Read side, heuristic.** `redirect_canonical()` is also on `template_redirect`. It is registered later (`default-filters.php:704`), so the exact match runs first.
  - Inside its `if ( is_404() )` branch (`canonical.php:147`), when nothing else has produced a URL, it calls `redirect_guess_404_permalink()`.
  - That function has three filters, added in WP 5.5: `do_redirect_guess_404_permalink`, `pre_redirect_guess_404_permalink` and `strict_redirect_guess_404_permalink`.
  - By default it builds `post_name LIKE 'requested%'`, a **prefix match**. Strict mode uses `post_name = %s`. The query is narrowed by publicly viewable statuses and types, and by year, month and day if present.
  - It runs `SELECT ID … WHERE …` through `$wpdb->get_var()`, with **no `ORDER BY`**. On multiple matches, the post returned is whatever row the DB returns first.
  - The guess is then sent as a 301 (`wp_redirect( $redirect_url, 301 )` at the end of `redirect_canonical`, `canonical.php` ~836).
  - Sources: https://developer.wordpress.org/reference/functions/redirect_guess_404_permalink/ and https://make.wordpress.org/core/2020/06/26/wordpress-5-5-better-fine-grained-control-of-redirect_guess_404_permalink/
- **So when does it 301 versus serve the guess?** It never *serves* the guessed content at the requested URL; it always 301s to the guessed permalink. It never shows a "did you mean" page.
- **What breaks it.**
  - The meta is deleted when the post is deleted.
  - Duplicate old slugs across posts are disambiguated only by date vars.
  - A new post taking an old slug wins, because the redirect only fires on a 404.
  - The guess can send users to unrelated content: `/run` could 301 to `/running-shoes-review`.
- **Is it self-recovering?** Yes, with zero author action, for posts. No for pages.

**Plugins as managed redirect tables.**

- **Redirection** keeps its own table with logs and 404 logs.
  - It can "monitor for URL changes to posts, pages, and custom post types, and auto-create a redirect". This extends the automatic behavior to pages and custom post types.
  - For *deleted* posts it creates the redirects disabled, so the author has to set a target.
  - Source: https://redirection.me/support/options/
- **Safe Redirect Manager** is a hand-managed table **[unverified: not fetched]**.

## 2. Ghost

- **Mechanism.** One author-managed file, `redirects.yaml` (formerly JSON), uploaded under Settings → Advanced → Labs. It supports `301` and `302`, and regex rules **[regex support per secondary sources]**. Source: https://ghost.org/help/redirects/
- **No automatic old-slug redirect**, as far as I could find. Ghost staff and the community say "create a redirect" after changing a published slug. **[unverified against an official statement; based on forum and secondary posts: https://brightthemes.com/blog/ghost-redirects and https://forum.ghost.org/t/changing-post-url-doesnt-update-older-internal-links/50241]**
- **Breaks when:** the author forgets, or edits the file.
- **Self-recovery:** none. The author has to set it up.

## 3. Hugo `aliases` and Jekyll `redirect_from`

These are the same table as primitive 2, materialized as files at build time so that dumb static hosts can serve them.

- **Hugo.** List old paths in the front-matter field `aliases`. For each alias, the build writes `public/<alias>/index.html` from an embedded template:
  - `<link rel="canonical" href="{{ .Permalink }}">`
  - `<meta http-equiv="refresh" content="0; url={{ .Permalink }}">`

  This is client-side and works on any host. Source: https://gohugo.io/content-management/urls/
- **Jekyll** (`jekyll-redirect-from`). The `redirect_from:` list generates a page at each old path containing an HTTP-REFRESH meta tag. A trailing slash produces `dir/index.html`; no trailing slash produces an extensionless file. `redirect_to:` handles outbound redirects. Source: https://github.com/jekyll/jekyll-redirect-from
- **SEO.** Google treats an *instant* meta refresh as a permanent redirect and a delayed one as temporary. Google ranks it below server-side 301 and 308 for reliable interpretation. Source: https://developers.google.com/search/docs/crawling-indexing/301-redirects
- **Breaks when:** the alias is removed from front matter, or another page builds to the same path. The collision outcome depends on the generator **[unverified]**.
- **Self-recovery:** no. The author has to write the alias. A rename does not record its own history.

## 4. Netlify and Cloudflare Pages `_redirects`

- **Netlify.**
  - The `_redirects` file and `netlify.toml` default to `status = 301`.
  - Rules support splats, placeholders, query matching, and conditions (country, language, role).
  - **Shadowing:** by default a rule does *not* override a file that exists at that path; `!` / `force = true` overrides.
  - Sources: https://docs.netlify.com/manage/routing/redirects/overview/ and https://docs.netlify.com/manage/routing/redirects/rewrites-proxies/
- **Cloudflare Pages.**
  - `_redirects` defaults to **302**, not 301.
  - Limits: 2,000 static plus 100 dynamic rules, 1,000 characters per rule. The first matching rule wins.
  - Not supported: query-parameter matching, domain-level rules, country or cookie conditions.
  - Beyond the limits, use **Bulk Redirects**, which run in front of the project.
  - Source: https://developers.cloudflare.com/pages/configuration/redirects/ ("Last updated Aug 25, 2026")
- **Relevance to physlane.** These are deploy-time config. User-generated slugs cannot live there. Not applicable except for physlane's own fixed route moves.
- **Self-recovery:** none. These rules are hand-written config.

## 5. GitHub and GitLab

**GitHub, repository rename.**

- Web traffic, issues, wikis, stars and followers redirect, and `git clone`, `fetch` and `push` keep working.
- Not redirected:
  - GitHub Pages project-site URLs.
  - Actions calls to a renamed repo ("will fail with the error `repository not found`").
- "If you create a new repository under your account in the future, do not reuse the original name … redirects to the renamed repository will no longer work."
- Source: https://docs.github.com/en/repositories/creating-and-managing-repositories/renaming-a-repository

**GitHub, username rename.**

- "your old username becomes available for anyone else to claim" — **immediately, no quarantine.**
- The old profile URL "will return a 404 error". Gist URLs also 404.
- Repository redirects keep working, **but** "If the new owner of your old username creates a repository with the same name as your repository, that will override the redirect entry". This is **per-path shadowing**: only colliding paths break, not the whole namespace.
- Exception — **namespace retirement**: if the account had public repos with a Marketplace action, or with more than 100 clones or more than 100 Actions uses in the prior week, `OLD-OWNER/REPO` is **permanently retired**. Container images with more than 5,000 downloads are retired the same way.
- No time-based expiry is documented.
- Sources: https://docs.github.com/en/account-and-profile/setting-up-and-managing-your-personal-account-on-github/managing-user-account-settings/changing-your-github-username and https://docs.github.com/en/account-and-profile/reference/username-reference
- Retirement exists because of "repojacking". Researchers reported bypasses that GitHub later patched. Source: https://portswigger.net/daily-swig/github-patches-bug-that-could-allow-access-to-another-users-repo **[secondary]**

**GitLab.**

- Covers user renames, group path changes and repo renames. "URLs for the namespace and everything under it … are redirected".
- "The redirects are available as long as the original path is not claimed by another group, user, or project." So a redirect has no fixed lifetime and dies on a claim, at **namespace** granularity.
- GitLab advises keeping the old namespace to protect redirects: "create a new group and transfer projects to it instead."
- Sources: https://docs.gitlab.com/user/project/repository/#repository-path-changes and https://docs.gitlab.com/user/group/manage/

**Self-recovery:** both are fully automatic.

## 6. Medium, Substack, Blogger, Tumblr

All four are mostly secondary sources; the Medium help page returned 403 to my fetch.

- **Medium, username change.** Search snippets of the official help page say the old profile link stops working, while "existing stories will be re-directed when people visit old URLs". Old @-mentions keep working. Source: https://help.medium.com/hc/en-us/articles/115004746707-Your-profile-page-URL **[snippet only]**
  - Medium story URLs end in a hex post ID, and it is plausible the ID drives the redirect, the same pattern as section 7. **[unverified inference]**
- **Substack.** It reportedly offers two options. The plain subdomain change breaks all links. "Change subdomain without breaking links" redirects, and is allowed **once**. Source: https://substackapi.com/docs/how-to-change-your-substack-url **[2023, third-party]**
- **Blogger.** When you set a custom domain, the old blogspot address can forward to it as a setting. The forwarding has broken historically (a 2009 outage). **[old, secondary sources]**
- **Tumblr.** Sources conflict on whether the old URL redirects. They agree the old name is immediately reclaimable, and users protect it by registering a placeholder blog. **[secondary]**
- **Takeaway.** Consumer platforms typically protect *content* URLs, often through a post ID, and abandon *profile* URLs. That is the GitHub pattern.

## 7. Immutable-ID permalinks: Reddit, Hacker News, arXiv, Stack Overflow, Discourse

- **Discourse, verified live.**
  - `https://meta.discourse.org/t/wrong-slug/83633` → `301` → `/t/how-do-url-topic-title-updates-work/83633`.
  - `/t/83633` alone also 301s to the same place.
  - Staff explanation: the topic ID is "the only required information … we'll even automatically redirect to the proper slug".
  - Source: https://meta.discourse.org/t/how-do-url-topic-title-updates-work/83633
- **Stack Overflow.** Same `/questions/{id}/{slug}` pattern, where the slug is decorative and corrected by redirect. **[not verified live: my curl got 403; community sources only]**
- **Reddit.** `/comments/{base36id}/{slug}`, same pattern. **[not verified live: blocked]**
- **Hacker News.** `item?id=N`. No title in the URL at all, so a rename cannot break a link.
- **arXiv.** `arXiv:YYMM.NNNNN{vV}`. Classification was deliberately removed from the ID "and thus reclassification after an article is announced is possible". Source: https://info.arxiv.org/help/arxiv_identifier.html
- **State and breakage.**
  - No redirect state at all. The ID column is the state.
  - Breaks only when the item is deleted or the ID is reused, which never happens.
  - Fully self-recovering for every rename.
  - Cost: an opaque token in every URL, and in physlane's case no clean author-scoped URL.

## 8. Persistent-identifier layers: DOI, handle.net, PURL

- **DOI.** DOIs are handles: `doi.org/10.1000/182` and `hdl.handle.net/10.1000/182` both returned `302` → `http://www.doi.org/hb.html` in my live test.
  - The DOI string cannot change after registration, and DOIs cannot be deleted.
  - The *registrant* (the publisher) must keep resolution URLs current, and can bulk-update them after platform moves.
  - Sources: https://www.crossref.org/documentation/register-maintain-records/maintaining-your-metadata/updating-your-metadata/ and https://www.crossref.org/membership/terms/ (terms "Last updated: 2025-July-11")
- **PURL** (Internet Archive).
  - Each PURL has a name, a target and a type: 301, 302 (default), 303, 307, 404 "temporarily gone", or 410 "permanently gone".
  - Resolution order: exact name, then case-insensitive match, then the longest-prefix "partial". A partial appends the rest of the path to the target.
  - Source: https://purl.archive.org/help
- **Structure.** A stable key you hand out (primitive 1), resolved through a registry the owner maintains (primitive 2). The indirection is the product; the content location is free to move.
- **Breaks when:** the registrant stops maintaining the target. The identifier itself never breaks.

## 9. Content addressing: IPFS CIDs

- A CID is the cryptographic hash of a block plus multicodec, multihash and multibase metadata. Change the content and you get a new CID. Source: https://docs.ipfs.tech/concepts/content-addressing/
- Renames are irrelevant because there is no name. *Every edit* is a new address, though, so "the current version" needs IPNS or DNSLink, which is a mutable pointer and therefore primitive 2 again.
- Not applicable to an editable training program.

## 10. Advisory and search layer

- **W3C "Cool URIs don't change"** (TimBL, 1998): "URIs don't change: people change them." Leave out author's name, subject, status, access level, file extension and software mechanism. Only the creation date is safe to include. Source: https://www.w3.org/Provider/Style/URI
  - Note: physlane deliberately puts the author's name *and* the subject in the URL. That is exactly the case Cool URIs warns against, and it is why the redirect table is needed at all.
- **Google, redirects.** Server-side 301 and 308 are the strongest canonical signals. The old URL becomes an "alternate name" that fades over time. Source: https://developers.google.com/search/docs/crawling-indexing/301-redirects (updated 2026-04-14)
- **Google, site moves.**
  - "Avoid chaining redirects … redirecting to the final destination directly". physlane's flattening matches this.
  - "Keep the redirects for as long as possible, generally at least 1 year … From users' perspective, consider keeping redirects indefinitely."
  - Source: https://developers.google.com/search/docs/crawling-indexing/site-move-with-url-changes
- **Change of Address tool.** Domain level only, never path level. It forwards signals for 180 days. Source: https://support.google.com/webmasters/answer/9370220
- **`rel=canonical` and the Change of Address tool only migrate *search* signals.** A human with an old link still needs a redirect. They are a complement to recovery, not a form of it.

---

## Synthesis

### Taxonomy

The surveyed systems resolve into **two structural primitives**, one heuristic, and one out-of-band layer. The axes inside primitive 2 are where the mapping lives, who writes it, and what ends it. That is why the other categories look different but are not.

| # | Approach | Instances | State | Writer | Ends when |
|---|---|---|---|---|---|
| 1 | Stable key in the URL; slug decorative or absent | Discourse, SO, Reddit, HN, arXiv, Medium post IDs, IPFS CID | none beyond the ID column | — | item deleted |
| 2 | Old key → current location mapping | WP `_wp_old_slug`, Redirection, Ghost yaml, Netlify/CF `_redirects`, Hugo/Jekyll aliases, GitHub/GitLab renames, PURL, DOI/handle target | one row per rename | automatic (WP, GitHub, GitLab) or author (Ghost, `_redirects`, aliases, PURL, DOI) | row deleted, path claimed (GitHub per-path, GitLab per-namespace), cap or expiry |
| 1+2 | Stable key resolved through a registry | DOI, handle, PURL | registry row | registrant | registrant neglect; the key never dies |
| 3 | Heuristic inference | WP `redirect_guess_404_permalink` | none; it queries live content | — | never "breaks", but can be wrong |
| 4 | Search-signal transfer | `rel=canonical`, Change of Address tool | in Google | owner | 180 days / recrawl |

Why the alias categories are not separate. Hugo and Jekyll aliases are primitive 2 *materialized as files*. `_redirects` is primitive 2 *as deploy config*. The only real difference between those and WordPress is the axis **automatic versus author-managed**. That axis decides whether recovery needs zero author action, and only automatic, rename-hooked writers achieve it: WordPress, GitHub, GitLab, the Redirection plugin's monitor, and physlane.

### What major platforms combine

- **Forums and Q&A** (Discourse, SO, Reddit): primitive 1 for content, no redirect table needed.
- **Code hosts** (GitHub, GitLab): primitive 2, automatic, ended by claims.
  - GitHub adds permanent retirement for high-traffic paths.
  - GitLab ends redirects at namespace granularity; GitHub at path granularity.
- **Blog CMSes**:
  - WordPress: primitive 2 (automatic) plus primitive 3.
  - Ghost: author-managed primitive 2 only.
- **Consumer publishing** (Medium, Tumblr): protects content URLs, likely by ID; drops profile URLs.
- **Scholarly publishing**: primitives 1 and 2 through a registry.

### Trade-offs for physlane

| | Cost on Workers + D1 | State size | Abuse surface | SEO |
|---|---|---|---|---|
| Exact-match history (current design) | one indexed lookup on a miss | bounded: ≤3 author rows per user, program rows per rename | squatting is bounded by quarantine plus rate limit | correct 301, flattened |
| Token-first resolution | one indexed lookup on unique `shareToken` | zero new state | none new; the token already grants access | n/a (`noindex`) |
| Guess-404 (WP prefix) | a `LIKE 'x%'` scan per 404 | zero | redirects to unrelated content; crawlers probing prefixes | soft-404 and wrong-canonical risk |
| ID permalink `/p/{id}` | one more route | zero | none, if it is public-only and never a grant | duplicate URL; needs a canonical tag |
| Generated alias pages / `_redirects` | n/a | n/a | n/a | n/a (no static build of user content) |

---

## Recommendations

### R1. Resolve unlisted URLs by `shareToken` before slugs (adopt)

**Baseline.** The current resolver goes: current slugs, then history, then the removed page, with the token suffix preserved (`plans/shareable-programs-plan.md:168-172`). Two failures follow:

- Author A renames from `alice` to `alice2`. After the 90-day quarantine, B claims `alice`, and "claiming deletes the row" (`:163-165`). Every unlisted link `/u/alice/{p}/{token}` that A handed out now 404s, or hits B's namespace. Yet the token alone identifies the program, because `shareToken` is "unique" (`:127`, `:138`).
- The fourth author rename drops the oldest row (cap of 3, `:165`), and links through that slug die the same way.

**Proposal.** When the path has a token segment, look the program up by `shareToken`:

- **Token found:** 301 to the current canonical token URL, or to the bare canonical URL if the program is public. This already matches line 24.
- **Token not found:** current behavior.

This is primitive 1 for unlisted links, at zero new state. It closes the whole bug class (reclaim, cap eviction, composed renames) for unlisted links, instead of patching each instance. It keeps the revocation semantics, because rotation and drafting mint a new token.

**Falsifier.** Two inputs would make me retract:

- If `shareToken` is ever scoped per author instead of globally unique.
- If the product wants a claim of `alice` to deliberately kill A's unlisted links.

Side note to check, but not a finding. `:170` says the resolver redirects "only when the target is **public**", while `:172` says token suffixes are preserved through redirects. Taken literally, `:170` would send renamed *unlisted* links to the removed page. The likely intent is "public, *or unlisted with a matching token*". Worth confirming in the spec.

### R2. Bound 301 caching (adopt)

**Baseline.** A bare 301 is cached by the browser. RFC 9110 §15.4.2: "A 301 response is heuristically cacheable … unless otherwise indicated by … explicit cache controls." https://www.rfc-editor.org/rfc/rfc9110#section-15.4.2

**What breaks.** The plan allows renaming back: "Re-claiming your own quarantined slug is a normal rename" (`:36`).

1. A renames `alice` → `alice2`. A browser caches the 301 `/u/alice/x` → `/u/alice2/x`.
2. Later A renames back. Now `/u/alice2/x` 301s to `/u/alice/x`.
3. That browser is stuck in a redirect loop.

A milder version happens after a claim. Browsers with the cached 301 never see B's content at `/u/alice/...`.

**Proposal.** Send `Cache-Control: max-age=86400` (or similar) on slug-history 301s. Google's permanent-redirect signal comes from the status code, so nothing is lost on SEO. Redirects from the canonical *token to bare* URL can stay long-lived.

**Falsifier.** A test where a bare 301 followed by a reverse rename does not loop in Chrome or Safari.

### R3. Revisit the 90-day quarantine against Google's one-year guidance (consider)

Google: "Keep the redirects … generally at least 1 year … consider keeping redirects indefinitely." In the current design a redirect can die at day 91, if someone claims the slug.

**Bounds.**

- With the 1-rename-per-90-days limit and the 3-row cap, a 365-day quarantine still bounds each account to at most 4 reserved author slugs (current plus 3).
- The current bound is about 2. Hoarding stays bounded either way.

Alternatively, keep 90 days and accept the lower bound. With R1 in place, only *public bare* links depend on this.

**Falsifier.** Evidence that quarantine-induced unavailability of names hurts sign-up conversion more than broken public links hurt.

### R4. Do not add WordPress guess-404 (reject)

Verified mechanics:

- Prefix `LIKE 'name%'`, then `get_var` with no `ORDER BY`. The pick among multiple matches is arbitrary.
- The guess is always a 301, so the wrong target is cached permanently (see R2).

physlane's real rename failure modes are already covered by an exact history plus R1. A prefix guess only helps with truncated or mistyped URLs, and in exchange it creates confident wrong 301s.

**Weaker alternative, if any.** On a miss under a known author, return a 404 *status* page that lists that author's public programs. It suggests and does not redirect, so it needs no state and has no canonical risk.

**Falsifier.** 404 logs showing a high share of program-slug *prefix* misses under valid authors.

### R5. A stable ID permalink for public programs (defer)

The Discourse and SO model is the strongest form of recovery, but it puts an opaque segment in every URL, against the settled clean `/u/{author}/{program}` design.

A middle option: a public-only `/p/{programId}` route that 301s to the current canonical URL, offered as "copy permanent link".

- It must **never** resolve an unlisted or draft program. The ID is not a grant; the token is (`:26`).
- It protects public links against claims and cap eviction.

Under current rate limits those events are rare, so defer it.

**Falsifier.** Post-launch 404 logs on `/u/{a}/{p}` where `{a}` was claimed. If they are non-trivial, ship `/p/{id}`.

### R6. Is the quarantine-plus-claim model consistent with GitHub?

Mostly consistent, and **stricter** than GitHub.

| | GitHub | GitLab | physlane (settled) |
|---|---|---|---|
| Old name claimable | immediately | immediately | after 90 days |
| Old profile URL | 404 immediately | redirects until claimed | redirects until claimed (profile only if something is public) |
| Content redirects after a claim | survive, except paths the claimant recreates (per-path shadowing) | die (namespace-level) | die (row deleted) |
| High-traffic protection | permanent retirement (>100 clones/week, Marketplace, >5,000 image downloads) | none documented | none; moderation force-rename |
| Expiry | none | none | none, except the claim and the 3-row cap |

The one place GitHub is weaker in theory but better for link survival is **per-path shadowing**. An optional low-cost variant for physlane:

- **Don't delete** the author history row on a claim; mark it claimed.
- The resolver tries the claimant's current paths first, then falls through to history for program slugs the claimant doesn't own.
- Profile `/u/alice` goes to the claimant.
- Cost:
  - The `fromSlug` PK must allow a claimant's own later rename-away to replace the row.
  - The UX is odd: `/u/alice` shows B, while `/u/alice/ppl` goes to A.

This matters less once R1 ships, because unlisted links no longer depend on it. Treat it as optional.

Retirement in the GitHub style is not needed. For physlane the risk analogous to repojacking is impersonation, not code execution, and the plan already routes that to moderation (`:40-41`).

### Considered and rejected

- `_redirects` or Bulk Redirects for user slugs: deploy-time config with a 2,100-rule cap.
- Alias pages: there is no static build of user content.
- IPFS: content-addressed, so every edit changes the address.
- The Change of Address tool: domain level only.
- The DOI/PURL registry model *is* physlane's history table plus a stable key. R1 and R5 are its local equivalents. An external registry adds nothing.

### Validation note on this report

I verified these from primary sources this session:

- WordPress internals, read from core source.
- GitHub and GitLab docs.
- Hugo and Jekyll docs.
- Netlify and Cloudflare Pages docs.
- Google Search docs and the RFC 9110 text.
- PURL docs.
- Discourse and DOI/handle behavior, tested live.

These rest on secondary or snippet sources:

- Stack Overflow and Reddit live behavior, and the Medium, Substack, Blogger, Tumblr and Ghost auto-redirect claims.

R1 assumes `shareToken` stays globally unique. Plan `:127` and `:138` say so.
