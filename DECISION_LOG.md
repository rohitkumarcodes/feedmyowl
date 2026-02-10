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
  - Do not auto-add `www` or infer TLD suffixes.
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
  - `j/k` work in list and reader contexts.
  - Arrow keys and `Enter` are list-only.
  - `r` refreshes feeds workspace-wide when not typing.
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
