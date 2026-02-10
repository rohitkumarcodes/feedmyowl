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
- Account logo selection (ASCII owl + favicon) from Settings.
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
