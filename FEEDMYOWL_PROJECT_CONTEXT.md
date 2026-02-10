# FeedMyOwl Project Context

## 1. Product definition
FeedMyOwl is a reading-first RSS/Atom reader.

Core loop:
1. Add a feed.
2. Optionally assign it to folders.
3. Refresh feeds.
4. Open an article.
5. Read.

## 2. Goals
- Provide calm, reliable reading.
- Keep navigation simple across desktop and mobile.
- Support lightweight organization through folders.

## 3. In scope
- Authentication.
- Feed subscription create, rename, delete.
- Folder create, rename, delete.
- Many-to-many feed-folder assignment.
- Manual refresh.
- Article list and reader.
- Global fuzzy article search in the article pane.
- Read-state tracking.
- Offline snapshot fallback for previously loaded data.
- Offline-only connectivity status message in workspace.
- Account settings (including configurable ASCII owl logo) and account deletion.
- Feed import progress feedback in settings.
- Desktop/tablet keyboard shortcuts with in-app help modal and one-time hint.
- Semantic sidebar notices (`error`, `progress`, `offline`, `info`) with accessibility roles.
- Settings keyboard shortcuts reference + docs link.

## 4. Out of scope
- Nested folders.
- Tags/categories separate from folders.
- Background refresh automation.
- Folder colors/icons and drag-drop ordering.

## 5. Experience model
### Desktop/tablet
- Three-pane layout:
  - Sidebar: global scopes + folder tree + feed rows.
  - Article list.
  - Reader.
- Sidebar toolbar includes:
  - `Refresh`
  - `Add feed/folder`
  - `Shortcuts (?)`
- Article list pane includes an always-visible search input for global article search.
- One-time shortcuts tip appears in the sidebar until dismissed/opened.
- Authenticated chrome brand:
  - Fixed text `Feed my owl`.
  - Per-user ASCII owl variant (default `{o,o}`), also used for favicon.

### Mobile
- Stacked views:
  - Feeds view.
  - Articles view.
  - Reader view.
- Folder interactions use compact inline/dialog flows.
- In-app back controls are deterministic (`Reader -> Articles -> Feeds`) and do not
  depend on unrelated browser history entries.
- Fixed brand slot is hidden on small screens to reduce top-of-screen crowding.

## 6. Data model
- `users`
- `folders`
- `feeds`
- `feed_folder_memberships`
- `feed_items`

Notes:
- `feed_folder_memberships` is the canonical many-to-many mapping.
- Legacy `feeds.folder_id` remains in transition and is kept in sync.
- `users.owl_ascii` stores the selected logo ASCII art per user and defaults to `{o,o}`.

## 7. API surface (active)
- `GET /api/feeds` -> feeds + folders
- `POST /api/feeds` -> create feed (supports folderIds)
- `PATCH /api/feeds` -> `item.markRead`, `account.delete`
- `PATCH /api/feeds/[id]` -> rename feed or set folders
- `DELETE /api/feeds/[id]` -> delete feed
- `POST /api/folders` -> create folder
- `PATCH /api/folders/[id]` -> rename folder
- `DELETE /api/folders/[id]` -> delete folder by mode
- `POST /api/refresh` -> manual refresh all user feeds
- `PATCH /api/settings/logo` -> persist selected user ASCII owl logo

## 8. Reliability defaults
- Feed refresh errors are tracked per feed with calm inline messaging.
- One failed feed must not block reading other feeds.
- Offline snapshot keeps previously loaded data available during disconnects.
- Offline message copy is fixed to: `You’re offline. You can still read cached articles.`
- Reconnect clears the offline message silently (no separate online banner).
- Message semantics:
  - `error` notices are assertive alerts and persist until dismissed/replaced.
  - `progress` and `offline` notices are polite non-dismissible statuses.
  - `info` notices auto-clear after 8 seconds unless they include an action.

## 9. Keyboard model defaults
- Enabled only on `/feeds` and only on desktop/tablet.
- Disabled while typing in editable fields.
- Key behavior:
  - `j/k` work in list and reader contexts.
  - Arrow keys + `Enter` are list-only.
  - `r` refreshes feeds.
  - `/` focuses article search.
  - `?` opens shortcuts help.
  - `Escape` closes the shortcuts dialog and clears the search input when focused.

## 10. Operational scripts
From repo root:
- `pnpm dev:web`
- `pnpm test:web`
- `pnpm lint:web`
- `pnpm build:web`
