# FeedMyOwl Project Context (MVP)

## 1. Product definition
FeedMyOwl is a simple RSS/Atom feed reader focused on reading.

The current phase is an intentionally narrow MVP. The product is optimized for the core loop:
1. Add a feed URL or site URL.
2. Refresh feeds.
3. Open an article.
4. Read comfortably.

## 2. MVP goals
- Provide a calm, reliable reading experience.
- Keep navigation and interaction simple.
- Minimize product surface area and operational complexity.

## 3. In scope
- Authentication.
- Feed subscription create and delete.
- Manual refresh.
- Article list and reader.
- Read-state tracking.
- Feed-content rendering in reader (no full-article extraction).
- Offline snapshot fallback for previously loaded feeds/items.
- Account settings and account deletion.

## 4. Out of scope (current MVP)
- Search.
- Folders, categories, tags.
- Billing and feed caps.
- Import/export workflows.
- Background refresh automation.

## 5. Experience model
### Desktop/tablet
- Fixed 3-pane layout:
  - Sidebar: `All articles` + flat feed list + `Add Feed`.
  - Article list.
  - Reader.
- Sidebar cannot be hidden.

### Mobile
- Stacked views:
  - Feeds view.
  - Articles view.
  - Reader view.
- Browser back integrates with view transitions.

## 6. Technical architecture
### Frontend
- Next.js app router.
- Client workspace orchestrates feed selection, article selection, and reader state.
- Minimal keyboard shortcuts (`j`, `k`, `Enter`, `r`).

### Backend
- Feed parsing via `rss-parser`.
- Add-feed uses direct feed parsing first, then conservative feed auto-discovery fallback for site URLs.
- API routes:
  - `POST /api/feeds` -> create feed.
  - `PATCH /api/feeds` -> `item.markRead`, `account.delete`.
  - `DELETE /api/feeds/[id]` -> delete feed.
  - `POST /api/refresh` -> manual refresh all user feeds.

### Data model
- Active entities for MVP behavior:
  - `users`
  - `feeds`
  - `feed_items`
- Folder-related schema currently remains in the database but is intentionally unused by MVP behavior.

## 7. Reliability and safety defaults
- Refresh failures are stored per feed with calm, user-facing messages.
- Reader renders feed content directly with no extraction dependency.
- Retention policy remains enabled.
- Offline snapshot provides read-only continuity when disconnected.

## 8. Operational scripts
From repo root:
- `pnpm dev:web`
- `pnpm test:web`
- `pnpm lint:web`
- `pnpm build:web`

## 9. Current success criteria
- A user can add feeds and read articles end-to-end without non-reading distractions.
- The interface has no visible folder/search/billing/import-export complexity.
- Desktop and mobile reading flows are both stable.

## 10. Next phase candidates (not committed)
- Reintroduce selected advanced features only after MVP validation.
- Evaluate whether search is needed based on user behavior.
- Decide whether dormant API/routes should be removed or retained as staged code boundaries.
