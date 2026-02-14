# FeedMyOwl Design Spec

## 1. Design goal
Prioritize uninterrupted reading while adding lightweight organization.

## 2. Product shape
### Desktop/tablet
Three panes:
1. Sidebar (scopes, folders, feeds, add controls)
2. Article list
3. Reader

### Mobile
Three stacked views:
1. Feeds
2. Articles
3. Reader
- In-app back buttons use deterministic transitions (`Reader -> Articles -> Feeds`)
  to avoid accidental exits caused by unrelated browser history.
- Small-screen layout hides fixed brand chrome and uses a reduced sidebar top reserve.

## 3. Sidebar information hierarchy
- Global scopes first (`All feeds`, `Uncategorized`)
- Toolbar actions (`Refresh`, `Add feed/folder`, `Shortcuts (?)` on desktop/tablet)
- One-time shortcuts hint area (dismissible on desktop/tablet)
- Sidebar message stack (progress/offline/info/error)
- Folder groups with explicit expand/collapse controls
- Feed rows nested under folders

## 4. Folder visual behavior
- Single-level folder hierarchy.
- Folder rows show name + feed count.
- Active folder and active feed use selected-state treatment.
- Feed rows can appear in multiple folder sections.

## 5. Interaction model
- Add-feed supports folder multi-select and inline folder creation.
- Add-feed site discovery is deterministic:
  - Direct parse failures still run candidate discovery fallback.
  - If base host discovery fails, a `www.<host>` probe is attempted for candidate links/paths.
- Feed row menu supports:
  - Edit name
  - Folders assignment checklist
  - Delete
- Folder row menu supports:
  - Edit name
  - Delete (with mode dialog)
- Workspace connectivity message appears only while offline and clears silently on reconnect.
- Sidebar notices are semantic and consistent:
  - `progress` and `offline` are non-dismissible status notices.
  - `info` is dismissible and auto-clears after 8s unless actionable.
  - `error` is dismissible and shown with stronger contrast.
- Add-feed submit must never fail silently; unexpected client exceptions surface explicit error notice text.
- Settings feed import is preview-before-import and shows numeric progress while processing feed URLs.
- Settings delete entry point is text-first (`Delete account...`) before confirmation.
- Settings keyboard shortcuts use a collapsed-by-default toggle (caret then keyboard icon)
  that expands with shutter motion into a boxed grouped reference.
- Article list keeps an always-visible global search input with strict-first fuzzy results.
- Active search replaces scoped list content but keeps sidebar scope selection visible.
- Search model defaults:
  - Activates at 2+ characters.
  - Strict pass runs first across title, feed title, snippet, and author.
  - Strict pass keeps only significant contiguous matches to reduce noisy fragment hits.
  - If strict pass returns no matches and query length is 4+ characters, typo fallback
    checks one-edit matches on title/feed-title tokens.
  - Ranks strict results by relevance then recency.
  - Ranks typo-fallback results by edit distance, then score, then recency.
  - Displays top 50 matches.
  - Highlights only significant contiguous article-title/feed-title ranges.
  - Typo fallback highlights the full matched title/feed token.
  - Significant snippet/author matches surface a source label (`Matched in ...`).

## 6. Keyboard model
- Scope and availability:
  - Active only on feeds workspace.
  - Active only on desktop/tablet; disabled on mobile.
  - Disabled while user is typing in editable targets.
- Key map:
  - `j`: open next article (list + reader contexts)
  - `k`: open previous article (list + reader contexts)
  - In feed scope, `j/k` continue to adjacent feed lists at boundaries (with wrap-around).
  - In `all`, `uncategorized`, and `folder` scopes, `j/k` stop at boundaries.
  - While search is active, `j/k` stay within search results only.
  - `ArrowDown`: select next article (list context)
  - `ArrowUp`: select previous article (list context)
  - `ArrowDown`: scroll down 3 lines (reader context)
  - `ArrowUp`: scroll up 3 lines (reader context)
  - `Space` / `PageDown`: scroll down one reading page with overlap (reader context)
  - `Shift+Space` / `PageUp`: scroll up one reading page with overlap (reader context)
  - `Enter`: open selected article (list context only)
  - `r`: refresh feeds
  - `f`: cycle pane focus (collapse sidebar -> collapse list -> expand list -> expand sidebar)
  - `/`: focus article search input
  - `?`: open shortcuts help modal
  - `Escape`: close shortcuts help modal or clear search input when focused
- Discoverability:
  - Visible toolbar entry `Shortcuts (?)`
  - One-time tip shown on desktop/tablet until dismissed or modal opened
  - Shortcuts modal width fits the longest shortcut row on desktop/tablet and remains
    capped to viewport width.

## 7. Accessibility baseline
- Folder toggles provide `aria-expanded`.
- Menus and dialogs are keyboard reachable and close on `Escape`.
- Focus-visible styles preserved for all interactive controls.
- Shortcuts dialog traps focus while open and returns focus on close.
- Message roles:
  - `error` uses `role="alert"` (assertive live region).
  - `progress`, `offline`, and `info` use `role="status"` (polite live region).

## 8. Security and reliability boundaries (2026-02-11)
- Manual refresh only (background jobs deferred).
- CSRF same-origin checks on mutating non-webhook routes.
- Rate limits enforced with Redis/Upstash; fail-open if Redis unavailable.
- Feed fetch hardening: SSRF blocking, redirect revalidation, timeout + retries.
- Conditional fetch support: ETag / Last-Modified.
- Reliable dedupe: GUID + content fingerprint with DB uniqueness.
- Mutating routes may return:
  - `403` with `code: "csrf_validation_failed"`
  - `429` with `code: "rate_limited"` and `Retry-After`
- `POST /api/refresh` may include additive per-feed `fetchState`:
  - `"updated"` when content changed and insert/upsert work ran.
  - `"not_modified"` when HTTP validators match and parsing/inserts are skipped.

## 9. Constraints
- No nested folders.
- No decorative folder colors/icons in this phase.
- No drag-drop ordering in this phase.

## 10. Brand behavior
- Authenticated layout brand keeps text fixed as `Feed my owl`.
- Brand owl is rendered as monospaced ASCII art from user preference.
- Default ASCII owl is `{o,o}` for users without a saved preference.
- Settings provides explicit selection + save; favicon mirrors selected ASCII owl.

## 11. Title tone behavior
- Article title dot marker remains unchanged.
- Unread titles use `--text-primary`.
- Read titles use `--text-secondary` with normal font weight.

## 12. Import/export behavior
- Import accepts OPML/XML and FeedMyOwl JSON.
- Import is preview-before-apply: selecting an import file generates a server-side preview (new/duplicate/error) before writing subscriptions.
- OPML folder mapping supports:
  - Nested outline context (flattened to one folder label such as `Tech / Web`).
  - `category` path values (for example `/Tech/Web`) mapped to the same flat folder label model.
- If one OPML feed lists multiple category paths, the feed is assigned to multiple folders.
- This remains compatible with the current single-level folder UI and many-to-many feed-folder model.

## 13. Import/export roadmap (beginner-friendly)
- Selective export:
  - Let users export all data, one folder, or selected feeds.
- Import conflict controls:
  - Let users choose to skip, merge folder assignments, or overwrite selected metadata.
- Portable JSON v3:
  - Keep subscriptions portable and optionally include reading-state metadata.
- Scheduled backups:
  - Automatic JSON exports with retention and clear restore flow.
