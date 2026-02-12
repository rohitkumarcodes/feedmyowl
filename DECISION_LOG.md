# FeedMyOwl Decision Log

This log records active product and technical decisions for the current app phase.

## How to read this file
- Status values: `active` or `superseded`.
- Date format: `YYYY-MM-DD`.

## Active decisions

### D-2026-02-07-01
- Date: 2026-02-07
- Status: active
- Decision: FeedMyOwl remains reading-first.
- Why: Keep the core add -> refresh -> read flow calm and reliable.

### D-2026-02-08-02
- Date: 2026-02-08
- Status: active
- Decision: Folders are reintroduced as multi-assignment organization.
- Why: Users need lightweight feed organization without changing the reading model.
- Details:
  - A feed may belong to multiple folders.
  - Uncategorized means a feed has zero folder assignments.
  - Sidebar shows feeds under every assigned folder.

### D-2026-02-08-03
- Date: 2026-02-08
- Status: active
- Decision: Sidebar scopes include `Read all feeds`, `Uncategorized`, folder scopes, and feed scopes.
- Why: Keep navigation explicit and scannable.

### D-2026-02-08-04
- Date: 2026-02-08
- Status: active
- Decision: Add-feed includes optional folder assignment and inline folder creation.
- Why: Reduce post-create cleanup work.

### D-2026-02-08-05
- Date: 2026-02-08
- Status: active
- Decision: Folder delete offers two modes.
- Why: Users need both safe cleanup and destructive cleanup.
- Modes:
  - `remove_only`: delete folder and remove membership links only.
  - `remove_and_unsubscribe_exclusive`: unsubscribe only feeds exclusive to that folder; keep cross-listed feeds.

### D-2026-02-09-01
- Date: 2026-02-09
- Status: active
- Decision: Add-feed uses explicit `discover -> create` flow with required candidate selection for ambiguous site URLs.
- Why: Reduce failed adds and prevent auto-subscribing to the wrong feed when multiple valid candidates exist.
- Details:
  - Input without scheme auto-normalizes to `https://`.
  - Do not auto-rewrite hostnames in user input or infer TLD suffixes during normalization.
  - If site-URL discovery cannot reach the typed host, discovery also probes `www.<host>` candidates before failing.
  - Interactive add supports bulk newline input with per-row outcomes.
  - No-feed fallback message is fixed to: `Error: We couldn't find any feed at this URL. Contact site owner and ask for the feed link.`

### D-2026-02-10-01
- Date: 2026-02-10
- Status: active
- Decision: App branding uses configurable per-user ASCII owl with explicit save from Settings.
- Why: Preserve playful brand identity while allowing user personalization without changing reading flows.
- Details:
  - Brand text remains fixed as `Feed my owl`.
  - Default owl for unsaved/new users is `{o,o}`.
  - Selection is persisted account-wide in `users.owl_ascii`.
  - Browser tab icon (favicon) mirrors the selected owl.

### D-2026-02-10-02
- Date: 2026-02-10
- Status: active
- Decision: Workspace connectivity status is offline-only with fixed copy.
- Why: Keep reliability feedback clear without introducing unnecessary status noise.
- Details:
  - Offline message copy is fixed to: `You’re offline. You can still read cached articles.`
  - Message is shown only when offline.
  - Reconnect clears status silently; there is no explicit online banner.

### D-2026-02-10-03
- Date: 2026-02-10
- Status: active
- Decision: Mobile in-app back is deterministic within the reading stack.
- Why: Prevent accidental exits from app context caused by unrelated browser history.
- Details:
  - Reader back targets Articles.
  - Articles back targets Feeds.
  - In-app back controls are not gated by browser history length.

### D-2026-02-10-04
- Date: 2026-02-10
- Status: active
- Decision: Settings import and account deletion flows emphasize explicit progress and clarity.
- Why: Improve trust and reduce ambiguity in long-running and destructive actions.
- Details:
  - Feed import shows numeric progress while processing.
  - Initial account deletion entry point is text-labeled (`Delete account...`) before confirmation.

### D-2026-02-10-05
- Date: 2026-02-10
- Status: active
- Decision: Public website top navigation includes About.
- Why: Improve findability of product mission/context content.

### D-2026-02-10-06
- Date: 2026-02-10
- Status: active
- Decision: Keyboard shortcuts are expanded into a focus-aware desktop/tablet model with explicit discoverability.
- Why: Improve keyboard efficiency without hijacking default reading behavior.
- Details:
  - `j/k` open next/previous articles in list and reader contexts.
  - In feed scope, `j/k` continue across adjacent feed lists at boundaries (with wrap-around).
  - In `all`, `uncategorized`, and `folder` scopes, `j/k` stop at boundaries.
  - While search is active, `j/k` stay within search results.
  - Arrow keys and `Enter` are list-only.
  - `r` refreshes feeds workspace-wide when not typing.
  - `f` cycles pane focus in order: collapse sidebar -> collapse list -> expand list -> expand sidebar.
  - `/` focuses article search.
  - `?` opens an in-app shortcuts dialog.
  - `Escape` closes the shortcuts dialog and clears the search input when focused.
  - A visible `Shortcuts (?)` button and one-time hint expose availability.

### D-2026-02-10-07
- Date: 2026-02-10
- Status: active
- Decision: Sidebar messages use semantic variants with consistent accessibility roles and timing rules.
- Why: Keep status feedback clear, calm, and screen-reader friendly.
- Details:
  - Variants: `error`, `progress`, `offline`, `info`.
  - `error` uses assertive alert semantics and persists until dismissed/replaced.
  - `offline` and `progress` are non-dismissible polite statuses.
  - `info` auto-clears after 8 seconds unless it includes an explicit follow-up action.

### D-2026-02-10-08
- Date: 2026-02-10
- Status: active
- Decision: Article title tone differentiates unread and read states while preserving dot markers.
- Why: Improve scanability with minimal visual churn.
- Details:
  - Dot marker remains.
  - Unread titles use stronger text tone.
  - Read titles use calmer tone and normal font weight.

### D-2026-02-10-09
- Date: 2026-02-10
- Status: active
- Decision: Feeds workspace adds global fuzzy article search in the article pane.
- Why: Improve retrieval speed for already-loaded reading data without adding backend complexity.
- Details:
  - Search input is always visible at the top of the article list pane.
  - Query activates fuzzy search at 2+ characters.
  - Active search is global across loaded articles and ignores selected scope for results.
  - Results are ranked by relevance, then recency, and capped to top 50.
  - Title and feed-name matches are highlighted.
  - Clearing search returns the list to the currently selected scope immediately.
  - Follow-up matching/typo behavior refinements are defined in D-2026-02-11-01.

### D-2026-02-10-10
- Date: 2026-02-10
- Status: active
- Decision: Settings keyboard shortcuts use a collapsed disclosure panel.
- Why: Reduce visual density in settings while keeping shortcut guidance discoverable.
- Details:
  - The toggle is collapsed by default.
  - Toggle visual order is caret icon first, then keyboard icon.
  - Expansion uses shutter motion aligned with existing settings motion patterns.
  - Expanded content is a boxed grouped shortcuts reference matching feeds modal styling.
  - Toggle button width matches the expanded panel width.

### D-2026-02-11-01
- Date: 2026-02-11
- Status: active
- Decision: Feeds search uses a strict-first pass plus typo fallback and significant-only highlight ranges.
- Why: Preserve precision/trust while restoring expected typo recovery for short reading queries.
- Details:
  - Strict global search remains primary and uses significant contiguous ranges.
  - If strict returns zero matches and query length is 4+ characters, fallback allows
    one-edit token matches on title/feed-title.
  - Typo fallback highlights the full matched title/feed token.
  - Significant snippet/author matches surface source labels (`Matched in ...`).

### D-2026-02-11-02
- Date: 2026-02-11
- Status: active
- Decision: Article retention is count-based with a hard cap of 50 items per feed.
- Why: Keep storage bounded while preserving recent reading context without deleting by age.
- Details:
  - Keep newest 50 rows per feed by `COALESCE(published_at, created_at) DESC, id DESC`.
  - Remove time-based retention windows from enforcement logic.
  - Enforce during write paths (create/import/refresh) and via existing read-path safety sweeps.

### D-2026-02-11-03
- Date: 2026-02-11
- Status: active
- Decision: Authenticated routes support an account-synced `light` / `dark` appearance mode.
- Why: Let users adjust reading comfort while keeping preference consistent across devices.
- Details:
  - Theme is persisted in `users.theme_mode`.
  - Settings toggles theme with instant apply + auto-save.
  - Authenticated routes apply the chosen mode; public/auth-entry pages remain light.
  - Clerk account surfaces follow the selected mode via shared appearance variables.

### D-2026-02-11-04
- Date: 2026-02-11
- Status: active
- Decision: Feed fetch and write paths are hardened while keeping user-triggered refresh behavior.
- Why: Security and reliability controls are required to keep feed ingestion trustworthy and predictable at scale.
- Details:
  - Manual refresh only (background jobs deferred).
  - CSRF same-origin checks on mutating non-webhook routes.
  - Rate limits enforced with Redis/Upstash; fail-open if Redis unavailable.
  - Feed fetch hardening: SSRF blocking, redirect revalidation, timeout + retries.
  - Conditional fetch support: ETag / Last-Modified.
  - Reliable dedupe: GUID + content fingerprint with DB uniqueness.
  - Mutating routes can return `403` with `code: "csrf_validation_failed"`.
  - Mutating routes can return `429` with `code: "rate_limited"` and `Retry-After`.
  - Refresh results can include additive `fetchState` values: `"updated"` or `"not_modified"`.
  - Data model additions: `feeds.http_etag`, `feeds.http_last_modified`,
    `feed_items.content_fingerprint`, and unique dedupe indexes by feed.

### D-2026-02-11-05
- Date: 2026-02-11
- Status: active
- Decision: OPML import keeps folder segregation for both nested outlines and OPML `category` paths.
- Why: Many feed tools store folder context differently, and users should not lose organization during migration.
- Details:
  - FeedMyOwl remains single-level folders only (no true nested folder tree).
  - Nested OPML paths are flattened into one folder label (example: `Tech / Web`).
  - OPML `category` values are parsed, split, normalized, and mapped into folder labels.
  - One feed can map to multiple folders when multiple category paths are present.

### D-2026-02-11-06
- Date: 2026-02-11
- Status: active
- Decision: Import/export improvements are tracked as a beginner-friendly roadmap.
- Why: New users need safer migration flows and clearer recovery options.
- Roadmap:
  - Import preview mode before writing changes.
  - Selective export by folder/feed instead of full-library only.
  - Explicit duplicate-conflict choices during import.
  - Portable JSON v3 with optional reading-state metadata.
  - Scheduled automatic backups with retention and guided restore.

### D-2026-02-12-01
- Date: 2026-02-12
- Status: active
- Decision: `/feeds` add feed/folder workflows prioritize explicit folder-create keyboard behavior and duplicate-folder merge consistency.
- Why: Remove silent/no-op interactions and make duplicate add outcomes align with selected folder intent.
- Details:
  - Pressing `Enter` in add-folder inputs creates a folder in both add-feed inline and sidebar add-folder forms.
  - Duplicate `feed.create` responses merge selected folder assignments into the existing subscription when new folders are provided.
  - Duplicate create responses include additive `mergedFolderCount`.
  - Bulk add summary distinguishes merged duplicates from unchanged duplicates.

### D-2026-02-12-02
- Date: 2026-02-12
- Status: active
- Decision: `Uncategorized` in `/feeds` has a destructive delete action with one explicit confirmation prompt.
- Why: Users requested a direct cleanup path for unassigned subscriptions while keeping behavior predictable.
- Details:
  - `Uncategorized` row shows an actions menu with `Delete` when uncategorized feeds exist.
  - Confirmation copy is fixed to: `Deleting uncategorized folder will delete both the folder and the feeds. Are you sure you want to delete?`
  - Confirming delete unsubscribes all feeds that currently have zero folder assignments.
  - `Uncategorized` remains existence-based: hidden when empty, automatically visible again when a new unassigned feed appears.

### D-2026-02-12-03
- Date: 2026-02-12
- Status: active
- Decision: Add-feed discovery fallback is deterministic for site URLs, including non-`www` host variants.
- Why: Users reported flaky "could not reach" outcomes for the same site URL when valid feed links existed.
- Details:
  - `feed.discover` always attempts candidate discovery fallback after direct parse failures, including non-`invalid_xml` errors.
  - If fallback validates at least one candidate, discovery returns normal candidate status (`single`, `multiple`, or `duplicate`).
  - If fallback validates none, direct non-`invalid_xml` error messaging is preserved.
  - Candidate XML validation uses one retry to reduce transient network failures.
  - Add-feed submit path surfaces an explicit error notice on unexpected client exceptions (no silent no-op).

## Superseded decisions

### D-2026-02-07-05
- Date: 2026-02-07
- Status: superseded
- Decision: Folder UX and folder API actions are removed.
- Superseded by: D-2026-02-08-02 through D-2026-02-08-05.

### D-2026-02-08-06
- Date: 2026-02-08
- Status: superseded
- Decision: Existing keyboard shortcuts remain unchanged (`j`, `k`, `Enter`, `r`).
- Superseded by: D-2026-02-10-06.
