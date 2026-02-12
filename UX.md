# FeedMyOwl UX Spec

## 1. Core user story
"I want to read my feeds in one calm place, organized into folders when needed."

## 2. Primary user flow
1. Open `/feeds`.
2. Add a feed URL or site URL.
3. Optionally assign one or more folders during add.
4. Refresh feeds.
5. Choose scope (`Read all`, `Uncategorized`, folder, or feed).
6. Optionally search all loaded articles from the article list pane.
7. Open and read an article.

Manual refresh only (background jobs deferred).

## 3. Sidebar behavior
- Top controls:
  - `Refresh feeds`
  - `Add feed/folder`
  - `Shortcuts (?)` (desktop/tablet only)
- Scope entries:
  - `Read all feeds`
  - `Uncategorized`
  - Folder rows (collapsible)
  - Feed rows under each folder
- Sections:
  - Shortcut tip area (one-time dismissible hint on non-mobile)
  - Add-feed and add-folder forms
  - Status message stack
  - Feed tree
- Brand slot:
  - Shows fixed text `Feed my owl`.
  - Shows selected ASCII owl (default `{o,o}`).
- Connectivity message:
  - Show `You’re offline. You can still read cached articles.` only when offline.
  - Do not show a separate "back online" status message.

## 4. Folder behavior
- Create folders from sidebar and add-feed form.
- `Enter` in add-folder inputs creates the folder:
  - Inline add-feed folder input: `Enter` creates folder (does not submit add-feed).
  - Sidebar add-folder form: `Enter` submits folder creation.
- Rename and delete folders from folder row actions.
- `Uncategorized` row includes an actions menu with a destructive `Delete` action.
- Deleting `Uncategorized` uses one confirmation prompt:
  - `Deleting uncategorized folder will delete both the folder and the feeds. Are you sure you want to delete?`
- Confirming uncategorized delete unsubscribes all currently uncategorized feeds.
- Delete dialog offers:
  - Delete folder only.
  - Delete folder and unsubscribe exclusive feeds.
- Dialog shows total, exclusive, and cross-listed feed counts.

## 5. Add-feed behavior
- Add form includes:
  - Input mode toggle: `Single URL` or `Paste many`.
  - Feed/site URL input (single mode).
  - Newline-separated URL textarea (bulk mode).
  - Folder multi-select.
  - Inline folder creation.
- URL handling:
  - Missing scheme auto-normalizes to `https://`.
  - Do not auto-add `www` or infer TLDs.
  - Feed fetch hardening: SSRF blocking, redirect revalidation, timeout + retries.
- Discovery flow:
  - Single add runs `discover` then `create`.
  - If exactly one addable feed is found, add proceeds automatically.
  - If multiple addable feeds are found, user must choose one before create.
  - If none are valid, show: `Error: We couldn't find any feed at this URL. Contact site owner and ask for the feed link.`
- Progress and feedback:
  - Stage messages: normalizing, discovering, awaiting selection, creating.
  - Inline duplicate hint disables submit for exact URL duplicates.
  - Duplicate create with selected folders merges assignments into the existing feed.
  - Successful single add closes form by default and offers `Add another`.
  - Cross-site request rejection shows `403` with `code: "csrf_validation_failed"`.
  - Rate-limit rejection shows `429` with `code: "rate_limited"` and `Retry-After`.
- Bulk behavior:
  - Rows are processed sequentially.
  - Rows with multiple discovered feeds fail with: `Multiple feeds found; add this URL individually to choose one.`
  - Summary shows imported, merged, unchanged-duplicate, failed counts and top failures.
- Default without assignments is Uncategorized.

## 6. Scope behavior
- `Read all`: all articles.
- `Uncategorized`: only feeds with no folder assignments.
- `Uncategorized` appears only when at least one feed has zero folder assignments.
- After deleting uncategorized feeds, the `Uncategorized` row disappears until a new unassigned feed exists.
- Folder scope: union of feeds in that folder.
- Feed scope: only that feed’s articles.
- Global search behavior:
  - Search input is always visible at the top of the article list pane.
  - Query length must be at least 2 characters to activate global fuzzy search.
  - Strict search pass runs first and requires significant contiguous matches.
  - If strict search returns no matches and query length is 4+ characters, fallback
    search runs one-edit typo matching on title and feed title tokens.
  - Active search ignores selected scope for results, but scope selection stays visible.
  - Changing scope while search is active keeps search active and keeps the current reader article open.
  - Results are ranked by relevance, then recency, and capped to top 50 matches.
  - Match highlighting appears in article title and feed title using significant contiguous ranges only.
  - Typo fallback highlights the full matching title/feed token.
  - Significant hidden-field hits display source labels (`Matched in snippet` / `Matched in author`).
  - `Escape` in the search input clears the query; pressing again may blur.

## 7. Mobile UX
- Keep stacked views: `Feeds -> Articles -> Reader`.
- Feeds view mirrors desktop information architecture, including folders.
- Folder and feed selection enters article list view with scoped title.
- In-app back controls are deterministic:
  - Reader back goes to Articles.
  - Articles back goes to Feeds.
  - In-app back controls should not rely on unrelated browser history entries.
- On small screens (`<= 767px`), hide fixed brand chrome and reduce top reserve spacing
  in the sidebar so feed content starts higher.

## 8. Accessibility
- Folder expand controls use `aria-expanded`.
- Overflow menus and dialogs dismiss with `Escape`.
- Keyboard shortcuts dialog is accessible (`role="dialog"`, focus trap, `Escape` close).
- Message semantics and live regions:
  - `error` uses `role="alert"` and assertive announcements.
  - `info`, `offline`, and `progress` use `role="status"` and polite announcements.

## 9. Keyboard shortcuts behavior
- Enabled only in feeds workspace on desktop/tablet.
- Disabled on mobile layout.
- Disabled while typing in editable targets (`input`, `textarea`, `select`, `contenteditable`).
- Key map:
  - `j`: open next article (list + reader context)
  - `k`: open previous article (list + reader context)
  - In feed scope, `j/k` continue across adjacent feed lists at boundaries (with wrap-around).
  - In `all`, `uncategorized`, and `folder` scopes, `j/k` stop at boundaries.
  - While search is active, `j/k` stay within search results only.
  - `ArrowDown`: next article (list context only)
  - `ArrowUp`: previous article (list context only)
  - `Enter`: open selected article (list context only)
  - `r`: refresh feeds
  - `f`: cycle pane focus (`sidebar -> list -> reader -> all panes`)
  - `/`: focus article search input
  - `?`: open shortcuts help modal
  - `Escape`: close shortcuts modal and clear search input when focused
- Discoverability:
  - Visible toolbar entry: `Shortcuts (?)`
  - One-time hint: `Tip: press ? to see shortcuts.`
  - Shortcuts modal width on desktop/tablet is content-driven by the longest row and
    remains viewport-capped.

## 10. Settings behavior
- Settings includes four section groups with consistent spacing:
  - `Feeds`
  - `Keyboard shortcuts`
  - `Hoot hoot`
  - `Delete account`
- Feeds import:
  - Import button shows numeric progress while processing (`Importing (x/y)...`).
  - Inline status text shows processed progress during the active import.
  - OPML folders are preserved from:
    - Nested outlines (flattened into one folder label, example `Tech / Web`).
    - OPML `category` paths (example `/Tech/Web` -> `Tech / Web`).
  - If one OPML feed has multiple categories, FeedMyOwl assigns that feed to multiple folders.
- Keyboard shortcuts settings section:
  - Shows a toggle button under `Keyboard shortcuts` with caret then keyboard icon.
  - Default state is collapsed.
  - Expands with shutter motion into boxed grouped shortcut reference
    (`Navigation`, `Reading actions`, `App actions`) styled like the feeds shortcuts modal.
  - Toggle button width matches the opened shortcuts box width.
  - Includes docs link to `/docs/#keyboard-shortcuts`.
- Owl chooser prompt: `Choose an owl to digest your feeds.`
- User selects one ASCII owl option:
  - `[o-o] Hooty Potter: The owl who lived (to read your feeds).`
  - `{O,O} Owlbert Einstein: Reading at the speed of light.`
  - `{o,o} Jane Owl-sten: "Pride and Prejudice and RSS."`
  - `{o,q} Sherlock Hoolmes: Solving the case of the unread items.`
  - `</o,o> The Devel-owl-per: while(awake) { read_feeds(); }`
- Owl chooser width behavior:
  - Chooser button and option rows share one pre-decided width.
  - Width is based on the longest chooser/option text and does not change on expand/collapse.
- Save model:
  - Explicit `Save owl` button.
  - Save button disabled while request is in flight or selection is unchanged.
  - On success, settings triggers route refresh so the in-app logo and browser-tab icon update.
- Delete flow:
  - Initial delete action is explicit text (`Delete account...`) under `Delete account`.
  - Deletion requires explicit second-step confirmation (`Yes, delete my account`).
- Persistence:
  - Account-wide (stored on user record), so selection follows sign-in across sessions/devices.

## 11. Message semantics and title tone
- Sidebar message variants:
  - `progress`: non-dismissible, polite status, shown for in-flight add/import style work.
  - `offline`: non-dismissible, polite status, shown only when offline.
  - `info`: dismissible; auto-clears after 8 seconds unless it includes an explicit follow-up action.
  - `error`: dismissible, stronger contrast, assertive announcement.
- Article list title tone:
  - Dot marker remains unchanged.
  - Unread titles use stronger text tone (`--text-primary`).
  - Read titles use calmer tone (`--text-secondary`) with normal font weight.

## 12. Security and reliability defaults (2026-02-11)
- Manual refresh only (background jobs deferred).
- CSRF same-origin checks on mutating non-webhook routes.
- Rate limits enforced with Redis/Upstash; fail-open if Redis unavailable.
- Feed fetch hardening: SSRF blocking, redirect revalidation, timeout + retries.
- Conditional fetch support: ETag / Last-Modified.
- Reliable dedupe: GUID + content fingerprint with DB uniqueness.
- Refresh results can include additive `fetchState`:
  - `"updated"` when content changed and writes were attempted.
  - `"not_modified"` when ETag/Last-Modified validators match and no new items are inserted.

## 13. Import/export improvements (beginner-friendly roadmap)
- Import preview before apply:
  - Show exactly what will be imported and where it will be placed before changing account data.
- Export selection controls:
  - Export all feeds or only selected folders/feeds when users want smaller or focused exports.
- Duplicate handling choices:
  - Let users choose how duplicates are treated, instead of one fixed behavior.
- Portable JSON v3:
  - Keep portability, and optionally include reading-state metadata for migrations.
- Automatic backups:
  - Offer scheduled exports with retention and an easy restore entry point.
