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
- `GET /api/articles`
- `POST /api/feeds`
- `PATCH /api/feeds`
- `PATCH /api/feeds/[id]`
- `DELETE /api/feeds/[id]`
- `POST /api/folders`
- `PATCH /api/folders/[id]`
- `DELETE /api/folders/[id]`
- `POST /api/refresh`
- `POST /api/feeds/import`
- `GET /api/feeds/export`
- `PATCH /api/settings/logo`
- `PATCH /api/settings/theme`

## 5. Security and reliability defaults (2026-02-11)
- Manual refresh only (background jobs deferred).
- CSRF same-origin checks on mutating non-webhook routes.
- Rate limits enforced with Redis/Upstash; fail-open if Redis unavailable.
- Feed fetch hardening: SSRF blocking, redirect revalidation, timeout + retries.
- Conditional fetch support: ETag / Last-Modified.
- Reliable dedupe: GUID + content fingerprint with DB uniqueness.
- Mutating routes can return:
  - `403` with `code: "csrf_validation_failed"`
  - `429` with `code: "rate_limited"` and `Retry-After`
- Refresh responses can include additive `fetchState` values:
  - `"updated"`
  - `"not_modified"`

## 6. Common incidents

### Feed cannot be added
1. Validate URL format.
2. For interactive add flow, check `POST /api/feeds` action `feed.discover`.
3. `POST /api/feeds` requires explicit `action` in JSON payload.
4. If discovery status is `multiple`, user must select one candidate before `feed.create`.
5. If discovery returns `invalid_xml`, expected message is: `Error: We couldn't find any feed at this URL. Contact site owner and ask for the feed link.`
6. If request is rejected with `csrf_validation_failed`, verify `Origin`/`Referer` uses a trusted app origin.
7. If request is rejected with `rate_limited`, inspect `Retry-After` and confirm user/IP request burst behavior.
8. For SSRF block events, inspect logs for `feed.fetch.blocked` (blocked host/private IP/metadata endpoint).
9. Check parser/network errors in logs.

### Folder operation fails
1. Validate folder name length and uniqueness.
2. Check `POST/PATCH/DELETE /api/folders` response and code.
3. Confirm user ownership of folder and feed mappings.

### Feed-folder assignment fails
1. Verify `PATCH /api/feeds/[id]` action `feed.setFolders`.
2. Confirm all submitted folder IDs belong to the same user.
3. Check membership table constraints.

### Imported feeds are not in expected folders
1. Confirm source file format is supported (`.opml`, `.xml`, `.json`).
2. For OPML files, verify whether folder data is stored in nested `<outline>` structure or in `category` attributes.
3. Expected mapping in current product model:
   - Nested path `Tech > Web` becomes folder label `Tech / Web`.
   - Category path `/Tech/Web` also becomes `Tech / Web`.
4. If one feed has multiple category paths, confirm multiple folder assignments are created.
5. Verify import response rows for duplicate handling:
   - `duplicate_merged` means folder assignments were merged into an existing feed.
   - `duplicate_unchanged` means no new folder assignment was added.

### Refresh fails for one or more feeds
1. Call `POST /api/refresh` while authenticated.
2. Review `last_fetch_*` fields per feed.
3. Confirm source feed still serves valid XML.
4. If refresh response includes `fetchState: "updated"`, content changed and item writes were attempted.
5. If refresh response includes `fetchState: "not_modified"`, this is expected from HTTP validator caching (ETag/Last-Modified).
6. If response is `429`, honor `Retry-After` and reduce burst refresh attempts.
7. If response is `403` with `csrf_validation_failed`, verify same-origin request headers.

### Rate limit rejection
1. Affected routes in this phase:
   - `POST /api/feeds`
   - `POST /api/feeds/import`
   - `POST /api/refresh`
2. Confirm response shape: status `429`, header `Retry-After`, body `code="rate_limited"`.
3. Validate user-level and IP-level request rates over the previous minute.
4. If limits are being hit unexpectedly, inspect edge/proxy IP forwarding headers.

### CSRF rejection on mutating routes
1. Confirm response status `403` with `code="csrf_validation_failed"`.
2. Ensure browser/API client sends `Origin`; `Referer` fallback is accepted.
3. Confirm origin is one of trusted app origins (prod app URL, local dev origins, configured env origin).
4. Webhooks are excluded from CSRF checks; do not apply browser-origin assumptions there.

### Duplicate articles still appear
1. Confirm migration `0010_feed_security_hardening` has been applied.
2. Verify indexes exist:
   - `feed_items_feed_id_guid_unique`
   - `feed_items_feed_id_content_fingerprint_unique`
3. Confirm duplicate rows are not violating `guid`/`content_fingerprint` uniqueness by feed.
4. Check insertion path uses conflict-safe inserts (`ON CONFLICT DO NOTHING`).

### Feed shows unexpected article count
1. Retention policy is count-based, not time-based: max 50 items per feed.
2. Trigger enforcement by loading `/feeds`, calling `GET /api/feeds`, or running `POST /api/refresh`.
3. Validate with SQL:
   `SELECT feed_id, COUNT(*) FROM feed_items GROUP BY feed_id HAVING COUNT(*) > 50;`
4. Expected result set is empty after enforcement paths run.

### Theme mode does not save or apply
1. Confirm `PATCH /api/settings/theme` returns `200` with `themeMode`.
2. If API returns `503`, apply latest DB migrations to add `users.theme_mode`.
3. Verify authenticated routes set `data-theme` on `<html>` while mounted.
4. Confirm non-auth pages (`/sign-in`, `/sign-up`) remain light after leaving auth routes.

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

### Infinite scroll paging looks wrong
1. Confirm request shape to `GET /api/articles`:
   - `scopeType=all|uncategorized|folder|feed`
   - `scopeId` only for `folder` and `feed`
   - optional `cursor`, optional `limit`
2. Confirm first `/feeds` render includes only the first article page (not full history).
3. Scroll near the end of the article list and confirm another `/api/articles` request is sent.
4. Confirm `nextCursor` changes after successful page loads while `hasMore=true`.
5. Confirm duplicate article IDs are not rendered when switching scopes and paging.
6. While search is active, confirm auto-load does not continue paging.
7. If paging fails, confirm inline retry appears and retry loads the next page.

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

## 7. Data model notes
- Canonical folder assignments: `feed_folder_memberships`.
- `feeds.folder_id` removed; folder assignment is membership-only.
- User logo preference field: `users.owl_ascii` (default `{o,o}`).
- Feed HTTP cache validators:
  - `feeds.http_etag`
  - `feeds.http_last_modified`
- Feed-item dedupe fallback key:
  - `feed_items.content_fingerprint`
- Feed-item dedupe unique indexes:
  - `(feed_id, guid)` where `guid IS NOT NULL`
  - `(feed_id, content_fingerprint)` where `guid IS NULL AND content_fingerprint IS NOT NULL`
- On folder delete:
  - `remove_only` removes memberships.
  - `remove_and_unsubscribe_exclusive` unsubscribes exclusive feeds only.

## 8. Smoke test after deploy
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
39. In `Read all feeds`, scroll repeatedly and confirm additional pages auto-load until `You’re all caught up.`
40. Switch between `all`, `uncategorized`, one folder, and one feed; confirm each scope initializes its own cursor paging and remains stable when returning to a previous scope.

## 9. Import/export roadmap (beginner-friendly)
- Import preview before apply:
  - Display detected feeds, folder mapping, duplicates, and failures before write.
- Selective export:
  - Export full library or only selected folders/feeds.
- Duplicate conflict policy controls:
  - Let users choose skip/merge/overwrite behavior during import.
- Portable JSON v3:
  - Keep current portability and optionally include reading-state metadata.
- Scheduled backups:
  - Support periodic automatic exports, retention limits, and guided restore.
