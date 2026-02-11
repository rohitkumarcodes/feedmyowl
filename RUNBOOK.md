# FeedMyOwl Runbook

## 1. Purpose
Operational guide for the reading-first app with folder organization and configurable ASCII owl branding.

## 2. Local development
From repo root:
- `pnpm dev:web`
- `pnpm test:web`
- `pnpm lint:web`
- `pnpm build:web`

## 3. User-facing surface
- Add/rename/delete feed.
- Create/rename/delete folder.
- Assign feeds to multiple folders.
- Discover feed candidates from site URLs before create.
- Bulk add feed/site URLs from sidebar add form.
- Manual refresh.
- Read articles.
- Global strict-first article search in article list pane with typo fallback (top 50 results).
- Offline-only workspace status message with cached-reading fallback copy.
- Desktop/tablet keyboard shortcuts with in-app help modal (`?`) and visible toolbar entry.
- One-time shortcuts hint in sidebar (dismissible, browser-local persistence).
- Semantic sidebar notices (`progress`, `offline`, `info`, `error`) with consistent behavior.
- Account logo selection (ASCII owl + favicon) from Settings.
- Settings feed import progress indicator (`Importing (x/y)...` + inline progress text).
- Settings keyboard shortcuts toggle panel (collapsed by default) with docs link.
- Account deletion.

## 4. Active API routes
- `GET /api/feeds`
- `POST /api/feeds`
- `PATCH /api/feeds`
- `PATCH /api/feeds/[id]`
- `DELETE /api/feeds/[id]`
- `POST /api/folders`
- `PATCH /api/folders/[id]`
- `DELETE /api/folders/[id]`
- `POST /api/refresh`
- `PATCH /api/settings/logo`

## 5. Common incidents

### Feed cannot be added
1. Validate URL format.
2. For interactive add flow, check `POST /api/feeds` action `feed.discover`.
3. If discovery status is `multiple`, user must select one candidate before `feed.create`.
4. If discovery returns `invalid_xml`, expected message is: `Error: We couldn't find any feed at this URL. Contact site owner and ask for the feed link.`
5. Check parser/network errors in logs.

### Folder operation fails
1. Validate folder name length and uniqueness.
2. Check `POST/PATCH/DELETE /api/folders` response and code.
3. Confirm user ownership of folder and feed mappings.

### Feed-folder assignment fails
1. Verify `PATCH /api/feeds/[id]` action `feed.setFolders`.
2. Confirm all submitted folder IDs belong to the same user.
3. Check membership table constraints.

### Refresh fails for one or more feeds
1. Call `POST /api/refresh` while authenticated.
2. Review `last_fetch_*` fields per feed.
3. Confirm source feed still serves valid XML.

### User reports offline banner behavior
1. Confirm device/browser network status is offline.
2. Expected copy is exactly: `You’re offline. You can still read cached articles.`
3. Confirm previously loaded feeds/articles remain readable from snapshot.
4. Reconnect network and verify banner clears without a separate online-status message.

### Keyboard shortcuts do not work
1. Confirm user is on `/feeds` workspace.
2. Confirm viewport is desktop/tablet (shortcuts are disabled on mobile layout).
3. Confirm focus is not in an editable field (`input`, `textarea`, `select`, contenteditable).
4. Verify scope behavior:
   - `j/k` should open next/previous article in list and reader contexts.
   - In feed scope, `j/k` should continue across adjacent feed lists at boundaries (with wrap-around).
   - In `all`, `uncategorized`, and `folder` scopes, `j/k` should stop at boundaries.
   - While search is active, `j/k` should stay within search results.
   - Arrow keys and `Enter` should work only in list context.
5. Verify `f` cycles pane focus in order:
   - collapse sidebar -> collapse list -> expand list -> expand sidebar.
6. Verify `r` triggers refresh when not typing.
7. Verify `/` focuses the article search input when not typing.
8. Press `?` to open shortcuts modal and validate key mapping list.

### Settings shortcuts panel looks wrong
1. Open `/settings` and find the `Keyboard shortcuts` section.
2. Confirm the panel is collapsed by default.
3. Confirm toggle order is caret icon first, then keyboard icon.
4. Expand and confirm shutter motion is used.
5. Confirm opened panel width matches the toggle button width.
6. Confirm grouped key rows are displayed and docs link is still present.

### Search behavior looks incorrect
1. Confirm search input is visible at the top of the article list pane.
2. Confirm query has at least 2 characters; 1-character query should not activate search.
3. Confirm strict search is global (ignores selected scope) and shows ranked results.
4. Confirm significant-only highlight behavior (no tiny fragment highlights such as
   `The`/`at` from unrelated words).
5. For 4+ character typo query (example: `heaet`), confirm fallback finds expected
   title/feed token (`Heart`).
6. Confirm typo fallback does not surface weak fragmented title-only noise (example:
   `The Art of Animation` for `heaet`).
7. If query returns many matches, confirm list caps at top 50 and shows cap notice.
8. Confirm snippet/author-driven results show `Matched in ...` source labels.
9. Press `Escape` in the search input to confirm query clears.

### Shortcut hint appears unexpectedly
1. Confirm browser localStorage key: `feedmyowl.shortcuts_hint.dismissed.v1`.
2. Expected hidden state is value `"true"`.
3. Opening shortcuts modal should also set dismissal state.
4. In private/incognito contexts, localStorage persistence may differ by browser policy.

### Sidebar message timing/semantics look wrong
1. Confirm message variant behavior:
   - `error`: `role="alert"`, persists until dismissed/replaced.
   - `offline`: `role="status"`, shown only while offline.
   - `progress`: `role="status"`, non-dismissible while active.
   - `info`: `role="status"`, auto-clears after ~8s unless actionable.
2. For actionable info (for example `Add another`), confirm auto-clear is skipped.

### Logo selection save fails
1. Confirm request payload contains a valid `owlAscii` value.
2. Call `PATCH /api/settings/logo` while authenticated.
3. Check for `400` (invalid selection), `404` (missing app user), `401` (auth), or `500` (server).
4. Confirm `users.owl_ascii` value changed and `updated_at` advanced.
5. Reload `/feeds` and verify both sidebar brand owl and favicon reflect saved value.

## 6. Data model notes
- Canonical folder assignments: `feed_folder_memberships`.
- Transitional compatibility field: `feeds.folder_id`.
- User logo preference field: `users.owl_ascii` (default `{o,o}`).
- On folder delete:
  - `remove_only` removes memberships.
  - `remove_and_unsubscribe_exclusive` unsubscribes exclusive feeds only.

## 7. Smoke test after deploy
1. Sign in.
2. Create a folder.
3. Add a single feed with a scheme-less URL (`example.com`) and confirm it resolves.
4. Add a site URL with multiple discovered feeds and confirm chooser gating.
5. Use bulk mode with mixed valid/duplicate/invalid URLs and verify summary.
6. Add a feed and assign it to multiple folders.
7. Verify `Add another` reopens add form with previous folder selection.
8. Refresh feeds.
9. Open an article and verify read-state.
10. Reassign feed folders via feed actions.
11. Delete a folder in both modes and verify expected outcomes.
12. Open Settings, change owl option, click `Save owl`, and verify sidebar brand + favicon update.
13. Reload, sign in again, and confirm owl choice persists.
14. Start a feed import from OPML/JSON and verify progress appears as numeric counts (`x/y`).
15. On mobile viewport, verify in-app back transitions `Reader -> Articles -> Feeds`.
16. On mobile viewport, verify top spacing is compact and fixed brand slot is hidden.
17. On settings page, verify first-step delete action is text-labeled (`Delete account...`).
18. On desktop/tablet, verify `Shortcuts (?)` button is visible in sidebar toolbar.
19. Press `?` and verify shortcuts modal opens, traps focus, and closes with `Escape`.
20. Verify one-time shortcut hint appears before dismissal and stays hidden after dismissal/reload.
21. Press `f` repeatedly on desktop/tablet and verify exact pane cycle order:
    collapse sidebar -> collapse list -> expand list -> expand sidebar.
22. Press `r` and verify feed refresh still triggers.
23. Verify `j/k` open next/previous articles in list and reader contexts, and in feed scope cross list boundaries with wrap-around.
24. Verify arrow keys move selection only in list context; reader keeps native arrow scrolling.
25. Trigger success info message and verify auto-clear after ~8 seconds.
26. Trigger actionable info message (`Add another`) and verify it does not auto-clear immediately.
27. Trigger an error and verify assertive rendering/dismiss behavior.
28. Verify article rows retain dot marker and show stronger unread vs read title tone.
29. On settings page, verify `Keyboard shortcuts` toggle is collapsed by default and docs link is present.
30. On website pages, verify global nav includes `About` with correct active state on `/about/`.
31. In article list, search with a 1-character query and confirm non-search hint is shown.
32. Search with a 2+ character query and confirm global ranked results are shown.
33. Verify search row clear button and `Escape` both clear the active query.
34. Press `/` from list and reader contexts and confirm focus moves to search input.
35. While search is active, change sidebar scope and verify search results remain global and the open reader article stays open.
36. Search `heart` and confirm exact match appears with contiguous highlight.
37. Search typo `heaet` and confirm typo fallback returns the `Heart` result.
38. Confirm typo fallback results do not show fragmented highlight noise for unrelated titles.
