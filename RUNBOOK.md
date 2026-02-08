# FeedMyOwl Runbook

## 1. Purpose
Operational guide for the reading-first app with folder organization.

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
- Manual refresh.
- Read articles.
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

## 5. Common incidents

### Feed cannot be added
1. Validate URL format.
2. Check `POST /api/feeds` response.
3. If site URL, verify discovery fallback candidates.
4. Check parser/network errors in logs.

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

## 6. Data model notes
- Canonical folder assignments: `feed_folder_memberships`.
- Transitional compatibility field: `feeds.folder_id`.
- On folder delete:
  - `remove_only` removes memberships.
  - `remove_and_unsubscribe_exclusive` unsubscribes exclusive feeds only.

## 7. Smoke test after deploy
1. Sign in.
2. Create a folder.
3. Add a feed and assign it to multiple folders.
4. Refresh feeds.
5. Open an article and verify read-state.
6. Reassign feed folders via feed actions.
7. Delete a folder in both modes and verify expected outcomes.
