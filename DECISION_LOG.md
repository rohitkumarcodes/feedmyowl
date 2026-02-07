# FeedMyOwl — Decision Log

> Every significant technical and product decision is recorded here with context,
> alternatives considered, and the reasoning behind the choice. This is the project's
> institutional memory. (Principle 8: Documentation as a first-class activity)

---

### 2026-02-07 — UX Companion Is Behavioral Source of Truth

**Decision:** `UX.md` is the primary source for behavioral product decisions. When `UX.md` conflicts with older behavior in `DECISION_LOG.md` or implementation details in other docs, we update those older entries/docs to match `UX.md`.

**Context:** The UX companion was added to prevent AI tools from defaulting to SaaS interaction patterns (modals, toasts, badges, overlays) that conflict with FeedMyOwl's reading-first mission.

**Alternatives considered:**
- Keep historical entries as-is and treat conflicts as unresolved — rejected because it leaves implementation ambiguous.
- Keep previous decisions over UX companion — rejected because it freezes known behavior mistakes.

**Principles referenced:** 7 (reading experience is sacred), 8 (documentation as first-class activity), 15 (AI as junior developer).

**Risks / tradeoffs:** Updating old decisions creates churn, but it removes ambiguity and improves implementation consistency.

---

### 2026-02-07 — Folder Deletion Behavior Revised: Reassign to Uncategorized

**Decision:** Deleting a folder now moves its feeds to Uncategorized (`folder_id = null`). Feed rows and feed items are preserved.

**Context:** This supersedes the 2026-02-06 destructive cascade decision. UX companion defines folder deletion as non-destructive to prevent accidental data loss and keep the reading history intact.

**Alternatives considered:**
- Keep destructive cascade — rejected because folder management should not destroy reading data.
- Block folder deletion until empty — rejected as unnecessary friction.

**Principles referenced:** 7 (reading experience), 6 (minimal surface area), 14 (users must be able to leave with data intact).

**Risks / tradeoffs:** Requires additional reassignment logic before deletion and FK behavior change in schema/migrations.

---

### 2026-02-07 — No "All Feeds" Aggregate Scope

**Decision:** The sidebar does not include an `All feeds` aggregate selection. The only scopes are a selected folder or a selected feed.

**Context:** UX companion explicitly forbids an unbounded aggregate scope because it recreates an attention-heavy "everything at once" experience.

**Alternatives considered:**
- Keep `All feeds` as convenience — rejected because it conflicts with bounded reading intent.
- Add hidden keyboard-only aggregate scope — rejected for the same reason.

**Principles referenced:** 7 (reading experience), 6 (minimal surface area).

**Risks / tradeoffs:** Some users may need one extra click to switch contexts. This is accepted as intentional product behavior.

---

### 2026-02-07 — Full-Article Extraction via Dedicated Parser Dependency

**Decision:** Add one extraction dependency (`@postlight/parser`) behind a module boundary (`lib/article-extractor.ts`) to support reliable full-article extraction with feed-summary fallback.

**Context:** UX companion requires full-article rendering when possible and quiet fallback when extraction fails. Existing feed fields alone are not reliable enough across diverse publishers.

**Alternatives considered:**
- No dependency; heuristic extraction only — rejected due poor reliability.
- Defer extraction entirely — rejected because it leaves a major UX requirement unimplemented.

**Principles referenced:** 7 (reading experience), 4 (modularity), 3 (battle-tested over novel).

**Risks / tradeoffs:** Adds one package to maintain. Mitigated by strict module boundary and fallback behavior.

---

### 2026-02-06 — Read/Unread State: Minimal Visual Tracking Only

**Decision:** Articles track whether they have been opened by the user. Opened articles are displayed with muted text color and normal font weight. Unopened articles use primary text color and semibold weight. There are no unread counts, no badges, no numbers next to feeds, and no "All Unread" smart feed.

**Context:** The project mission forbids unread counts and badges because they create compulsive checking behavior (see Product Definition: "no unread counts badgering the user to come back"). However, some visual orientation is needed so users can find their place in a list of articles. The compromise is a subtle typographic difference — enough for wayfinding, not enough to create anxiety.

**Alternatives considered:**
- No tracking at all (every article looks identical) — rejected because users would lose their place in long article lists, harming the reading experience
- Full unread tracking with counts and badges (NetNewsWire-style) — rejected because it directly violates the project's attention-preservation mission

**Principles referenced:** 7 (reading experience is sacred), 6 (minimal surface area)

**Risks / tradeoffs:** Users accustomed to traditional feed readers may initially feel the interface is "missing" unread counts. This is intentional and aligned with the product's differentiation.

---

### 2026-02-06 — Folders: Included in MVP

**Decision:** The sidebar will support folders (expandable/collapsible groups of feeds) in the MVP. Users can create folders, move feeds into them, and rename or delete folders. Feeds not assigned to a folder appear in an "uncategorized" section at the bottom of the sidebar.

**Context:** Previously marked as "To be decided" in the project context document. Folders are a lightweight organizational tool that helps users manage feeds without adding complexity. They are a standard feature of every major feed reader and are expected by users.

**Alternatives considered:**
- Flat list only (no folders) — rejected because even a modest number of feeds (~15+) becomes hard to scan without grouping
- Tags instead of folders — rejected as more complex to implement and less familiar to users; violates Principle 6 (minimal surface area)

**Principles referenced:** 6 (minimal surface area — folders are simple enough to justify), 7 (reading experience — organization aids focused reading), 3 (battle-tested pattern from every feed reader)

**Risks / tradeoffs:** Adds complexity to the sidebar UI and data model (feeds have an optional folder_id). Acceptable for MVP.

---

### 2026-02-06 — Search: Client-Side Filtering in MVP

**Decision:** A search input in the toolbar allows users to filter the currently visible article list by matching against article title and snippet text. Filtering happens client-side, on keystroke (debounced ~150ms). No full-text search of article bodies in the MVP. Pressing Escape clears the search.

**Context:** Previously marked as "To be decided" in the project context document. Searching is essential once a user has more than a handful of feeds. Client-side filtering of already-loaded articles is the simplest possible implementation.

**Alternatives considered:**
- No search in MVP — rejected because finding a specific article in a long list without search is frustrating, which harms the reading experience
- Full-text server-side search (PostgreSQL full-text search) — deferred to a future phase; unnecessary complexity for MVP where article lists are already loaded client-side

**Principles referenced:** 7 (reading experience), 6 (minimal surface area — client-side only, no new API routes)

**Risks / tradeoffs:** Client-side filtering won't scale if a user has thousands of articles loaded. Acceptable for MVP; can upgrade to server-side search later.

---

### 2026-02-06 — Dark Mode: Automatic via prefers-color-scheme

**Decision:** The app supports dark mode, activated automatically based on the user's system preference (`prefers-color-scheme: dark`). There is no manual toggle in the UI for the MVP. All colors are defined as CSS custom properties, overridden inside a `@media (prefers-color-scheme: dark)` block.

**Context:** Previously marked as "To be decided" in the project context document. Dark mode is nearly universal in modern applications and important for comfortable reading in low-light environments, which directly serves the reading mission.

**Alternatives considered:**
- No dark mode — rejected because reading in dark environments without dark mode causes eye strain, which harms the reading experience
- Manual toggle (user picks light/dark/auto) — deferred; adds UI complexity and requires persisting the preference. The automatic behavior covers the majority of users. Can add a toggle later.

**Principles referenced:** 7 (reading experience is sacred — eye comfort), 6 (minimal surface area — automatic, no UI control needed)

**Risks / tradeoffs:** Users who want dark mode in a light-OS environment (or vice versa) cannot override. Acceptable for MVP.

---

### 2026-02-06 — Read State Persistence in Database (`read_at`)

**Decision:** Keep minimal read/unread visuals, but persist read state in the database using `feed_items.read_at`. Opening an article sets `read_at` and the list renders opened items in muted/normal-weight typography.

**Context:** Minimal visual tracking had already been chosen, but persistence behavior needed to be explicit. Persisting read state keeps orientation consistent across refreshes and sessions.

**Alternatives considered:**
- Client-only storage (localStorage/sessionStorage) — rejected because state would be device/browser-specific and reset-prone.
- Session-only in-memory state — rejected because it disappears on reload and breaks continuity.

**Principles referenced:** 7 (reading experience), 6 (minimal surface area).

**Risks / tradeoffs:** Adds a write on article-open and requires ownership checks in API handlers.

---

### 2026-02-06 — Folder Deletion Behavior: Destructive Cascade

**Decision:** Deleting a folder deletes every feed inside that folder and all associated feed items via cascade foreign keys.

**Status:** Superseded on 2026-02-07 by "Folder Deletion Behavior Revised: Reassign to Uncategorized."

**Context:** Folder support was selected for MVP, but deletion semantics were unresolved. A destructive cascade keeps the backend and UI logic simpler for MVP.

**Alternatives considered:**
- Move all feeds to uncategorized on folder delete — rejected because it adds extra migration logic and edge cases.
- Block folder deletion until empty — rejected because it adds friction and additional state handling.

**Principles referenced:** 6 (minimal surface area), 5 (retractability through backups/rollbacks).

**Risks / tradeoffs:** Accidental folder deletion is high impact. Mitigated by explicit confirmation in UI and backup discipline.

---

### 2026-02-06 — Feed API Surface: Action Payloads on Existing Routes

**Decision:** Keep route surface area unchanged and extend existing feed routes with action payloads:
- `POST/PATCH /api/feeds` for folder/create/read actions
- `PATCH/DELETE /api/feeds/[id]` for feed-specific actions

**Context:** We needed folder and read-state mutations without adding new route files, consistent with MVP constraints.

**Alternatives considered:**
- Add dedicated routes (`/api/folders`, `/api/items/:id/read`) — rejected to avoid route sprawl.
- Keep only legacy feed create/delete endpoints — rejected because new functionality required additional mutations.

**Principles referenced:** 6 (minimal surface area), 4 (modularity through stable boundaries).

**Risks / tradeoffs:** Action-dispatch handlers can become harder to maintain if too many actions accumulate.

---

### 2026-02-06 — ESLint Setup: Non-Interactive Lint Command

**Decision:** Replace prompt-based `next lint` setup flow with explicit ESLint configuration (`eslint.config.mjs`) and a direct lint script (`eslint src --ext .ts,.tsx`).

**Context:** `next lint` prompted for first-time setup and could block CI or automation.

**Alternatives considered:**
- Keep `next lint` with interactive setup — rejected because it is unreliable in automated environments.
- Keep legacy `.eslintrc` path with compatibility env flags — rejected as a temporary workaround and not the long-term default.

**Principles referenced:** 13 (assume you will be unavailable), 6 (minimal operational friction), 8 (maintainable project operations).

**Risks / tradeoffs:** ESLint config may need periodic updates as Next.js/ESLint versions evolve.

## 2026-02-06 — MVP Scope: Feed-Only Mode (Payments Deferred)

**Decision:** Current implementation phase is explicitly feed-only MVP: users can add feeds, refresh feeds, and read feeds in-app. Payment UI and feed-count gating are deferred until phase 2. Payment backend modules/routes remain in the codebase but are intentionally dormant.

**Context:** The app had visible billing/subscription UI and free-tier gating logic before first-user validation. To reduce launch surface area and get a usable product in front of users faster, scope was narrowed to the core reading loop.

**Alternatives considered:**
- Keep payment UI visible but disabled — rejected because it adds UX noise and non-essential complexity during MVP validation.
- Fully remove payment backend modules — rejected because we already have modular payment boundaries and want fast reactivation in phase 2.
- Keep free-tier cap (10 feeds) without billing — rejected because it creates a paywall path that currently cannot be completed.

**Principles referenced:** 6 (minimal surface area), 7 (reading experience is sacred), 4 (modularity), 5 (retractability).

**Risks / tradeoffs:**
- No monetization path during MVP period.
- Potentially higher infrastructure usage from uncapped feeds in the short term.
- Requires disciplined follow-up to reintroduce billing and feed caps in phase 2.

---

## 2026-02-06 — Domain Name: feedmyowl.com

**Decision:** Registered `feedmyowl.com` as the project domain.

**Context:** Needed to secure a domain before starting development. The original preference was `feedtheowl.com`.

**Alternatives considered:**
- feedtheowl.com — unavailable for purchase

**Principles referenced:** N/A (business decision).

**Risks / tradeoffs:** None significant. "Feed My Owl" works well as a brand name.

---

## 2026-02-06 — Complete Tech Stack Selection

**Decision:** Full tech stack chosen:
- **App framework:** Next.js 15 + TypeScript on Vercel
- **Blog/landing:** Eleventy 3 on Vercel
- **Database:** PostgreSQL on Neon (via Drizzle ORM)
- **Auth:** Clerk
- **Payments:** Stripe
- **Email:** Resend
- **Feed parsing:** rss-parser
- **Error tracking:** Sentry
- **Uptime monitoring:** UptimeRobot
- **DNS:** Cloudflare

**Context:** This is the foundational decision for the entire project. It needed to be made before any code was written, prioritizing AI-assistability (founder is not a programmer), managed services, battle-tested tools, and modularity.

**Alternatives considered:**
- SvelteKit — smaller ecosystem, less AI training data, fewer Stack Overflow answers. Rejected per Principle 3.
- Django (Python) — would require separate frontend framework, violating Principle 1 (one stack).
- Supabase (bundled DB + auth) — couples database and auth into one provider, violating Principle 4 (modularity). If Supabase has issues, both DB and auth fail together.
- Railway (hosting) — no time limits on serverless functions, but costs from day one and less seamless rollback than Vercel.
- Astro (blog) — good but newer than Eleventy; founder explicitly preferred Eleventy; 11ty has been battle-tested since 2018 with zero framework dependencies.
- Auth.js/NextAuth — open source but requires more hands-on security work. Too risky for a non-programmer. Rejected per Principle 11.

**Principles referenced:** 1 (one stack), 2 (managed services), 3 (battle-tested), 4 (modularity), 5 (retractability via Vercel rollbacks), 11 (security by delegation), 15 (AI-assistable stack).

**Risks / tradeoffs:**
- Vercel serverless function timeout (10s free, 60s paid) constrains feed fetching. Mitigated by fetching feeds in parallel.
- Clerk is a third-party dependency for auth. Mitigated by syncing user data to our own database.
- Heavy reliance on free tiers. If multiple services change pricing simultaneously, costs could jump. Mitigated by monitoring costs regularly (Principle 12) and modularity (Principle 4).

---

## 2026-02-06 — Monorepo with pnpm Workspaces (No Turborepo)

**Decision:** Use pnpm workspaces for the monorepo. Do not add Turborepo.

**Context:** The project has two apps (Next.js web app and Eleventy blog). Need to manage them in one repository.

**Alternatives considered:**
- Turborepo — adds build caching and task orchestration, but our two apps share no code. Turborepo adds complexity without benefit.
- Separate repos — harder to manage, especially for a solo founder.

**Principles referenced:** 6 (minimal surface area), 1 (one stack).

**Risks / tradeoffs:** If we later add shared packages, we may want Turborepo. But for now, pnpm workspaces alone is simpler.

---

## 2026-02-06 — Next.js 15 (Not 16)

**Decision:** Use Next.js 15, not the newer 16.

**Context:** Next.js 16 exists but is newer with less community documentation.

**Alternatives considered:**
- Next.js 16 — latest but less documentation, fewer community answers, less AI training data.

**Principles referenced:** 3 (battle-tested over novel).

**Risks / tradeoffs:** May need to upgrade later. But upgrading from 15 → 16 is a well-documented path.

---

## 2026-02-06 — UUID Primary Keys

**Decision:** All database tables use UUID v4 as primary keys.

**Context:** Need to choose a primary key strategy.

**Alternatives considered:**
- Auto-incrementing integers — simpler but allows enumeration (user 1, user 2, etc.) and doesn't work well in distributed systems.
- ULID / CUID — viable but less standard than UUID.

**Principles referenced:** 11 (security by delegation — UUIDs prevent enumeration attacks).

**Risks / tradeoffs:** UUIDs are larger than integers (16 bytes vs 4 bytes), slightly slower for indexing. Negligible at our scale.

---

## 2026-02-06 — Cascade Deletes on Foreign Keys

**Decision:** Use cascade deletes: deleting a user deletes their feeds; deleting a feed deletes its items.

**Context:** Need a strategy for handling related data when parent records are deleted.

**Alternatives considered:**
- Soft deletes — more complex, requires filtering deleted records everywhere. Overkill for MVP.
- Manual deletion — error-prone, could leave orphaned records.

**Principles referenced:** 6 (minimal surface area).

**Risks / tradeoffs:** Cascade deletes are irreversible. If a user is accidentally deleted, their feeds and items are gone. Mitigated by database backups (Principle 10).

---

## 2026-02-06 — Clerk Webhooks for User Sync

**Decision:** When a user signs up via Clerk, a webhook creates a corresponding row in our `users` table in PostgreSQL.

**Context:** We need user data in our own database to link feeds and items via foreign keys, and to store app-specific fields (subscription tier, Stripe IDs).

**Alternatives considered:**
- Only use Clerk's user data — would mean no FK relationships and total dependency on Clerk for user data.
- Create user on first API request — adds latency and complexity to every API route.

**Principles referenced:** 4 (modularity — we own our data even if we switch auth providers).

**Risks / tradeoffs:** Webhook delivery is not 100% guaranteed. If a webhook fails, the user exists in Clerk but not in our database. Can be mitigated with a "just-in-time" check in API routes.

---

## 2026-02-06 — Nunjucks for Eleventy Templates

**Decision:** Use Nunjucks (.njk) as the template language for the Eleventy blog.

**Context:** Eleventy supports multiple template languages (Nunjucks, Liquid, Handlebars, etc.).

**Alternatives considered:**
- Liquid — widely used (Shopify, Jekyll) but less powerful than Nunjucks.
- Handlebars — less commonly used with Eleventy.

**Principles referenced:** 3 (battle-tested — Nunjucks is the most commonly used Eleventy template language with the best documentation).

**Risks / tradeoffs:** None significant.
