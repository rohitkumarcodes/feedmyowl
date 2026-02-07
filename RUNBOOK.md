# FeedMyOwl Runbook (MVP)

## 1. Purpose
Operational guide for the reading-only MVP.

This runbook focuses on keeping the feed reading loop healthy.

## 2. Local development
From repo root:
- `pnpm dev:web`
- `pnpm lint:web`
- `pnpm build:web`

## 3. MVP surface area
### User-facing
- Add feed.
- Delete feed.
- Manual refresh.
- Read articles.
- Account deletion.

### API routes in active use
- `POST /api/feeds` (feed create)
- `PATCH /api/feeds` (`item.markRead`, `item.extractFull`, `account.delete`)
- `DELETE /api/feeds/[id]` (feed delete)
- `POST /api/refresh` (manual refresh)

## 4. Environment checks
Minimum required for the web app:
- Auth configuration (Clerk keys).
- Database connection (Neon/Postgres URL).
- Optional error tracking config.

If feeds cannot be created/refreshed, first verify auth + DB env vars.

## 5. Common incidents
### Feed cannot be added
Checklist:
1. Confirm URL is valid `http` or `https`.
2. Check API response from `POST /api/feeds`.
3. Validate parser behavior against the feed URL.
4. Inspect server logs for parser/network errors.

### Refresh fails for one or more feeds
Checklist:
1. Call `POST /api/refresh` while authenticated.
2. Review per-feed `last_fetch_*` fields in DB.
3. Confirm feed URL still returns valid RSS/Atom.
4. Treat partial failures as non-blocking unless all feeds fail.

### Article reads but full extraction is missing
Checklist:
1. Confirm item has `link`.
2. Trigger article open to invoke `item.extractFull`.
3. Check `extraction_status`, `extraction_source`, `extracted_at`.
4. If extraction fails, fallback feed content is expected behavior.

### Read-state does not persist
Checklist:
1. Confirm `PATCH /api/feeds` with `item.markRead` returns success.
2. Verify `feed_items.read_at` updates.
3. Check auth ownership of the item/feed relationship.

## 6. Smoke test after deploy
1. Sign in.
2. Add a feed.
3. Refresh feeds.
4. Open an article.
5. Verify article is marked read.
6. Verify reader still works if extraction fails.
7. Delete a feed.

## 7. Data and retention notes
- Retention policy remains active.
- Folder schema may still exist in DB but is not part of current MVP behavior.
- Avoid schema cleanup during MVP unless required for stability.

## 8. Escalation guideline
Escalate to engineering if any of these occur:
- All feed refreshes fail across multiple users.
- Authenticated users consistently cannot create feeds.
- Reader cannot render fallback feed content.
- Account deletion path fails repeatedly.
