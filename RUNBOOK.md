# FeedMyOwl Runbook (MVP)

## 1. Purpose
Operational guide for the reading-only MVP.

This runbook focuses on keeping the feed reading loop healthy.

## 2. Local development
From repo root:
- `pnpm dev:web`
- `pnpm test:web`
- `pnpm lint:web`
- `pnpm build:web`

## 3. MVP surface area
### User-facing
- Add feed (feed URL or site URL).
- Delete feed.
- Manual refresh.
- Read articles.
- Account deletion.

### API routes in active use
- `POST /api/feeds` (feed create)
- `PATCH /api/feeds` (`item.markRead`, `account.delete`)
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
3. If a site URL was submitted, verify discovery fallback inputs:
   - Check the page for `<link rel="alternate"...>` feed references.
   - Check common feed paths (`/feed`, `/feed.xml`, `/rss`, `/rss.xml`, `/atom.xml`, `/?feed=rss2`).
4. Validate parser behavior against the resolved feed URL.
5. Inspect server logs for parser/network errors.

### Refresh fails for one or more feeds
Checklist:
1. Call `POST /api/refresh` while authenticated.
2. Review per-feed `last_fetch_*` fields in DB.
3. Confirm feed URL still returns valid RSS/Atom.
4. Treat partial failures as non-blocking unless all feeds fail.

### Article content looks incomplete or unexpected
Checklist:
1. Confirm `feed_items.content` is populated for the item.
2. Compare rendered body with the feed payload from the source URL.
3. Confirm reader sanitization did not remove unsafe markup.
4. Use "Open original" to verify source article remains reachable.

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
6. Verify reader renders feed-provided content.
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
