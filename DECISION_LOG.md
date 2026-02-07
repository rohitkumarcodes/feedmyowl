# FeedMyOwl Decision Log (MVP)

This log records active product and technical decisions for the current MVP phase.

## How to read this file
- Status values: `active` or `superseded`.
- Scope: only decisions that apply to the current reading-only MVP.
- Date format: `YYYY-MM-DD`.

## Active decisions

### D-2026-02-07-01
- Date: 2026-02-07
- Status: active
- Decision: FeedMyOwl is a reading-only MVP.
- Why: Ship the smallest useful product quickly.
- In scope: add feed, refresh, article list, article reader, read-state, account deletion.
- Out of scope: billing, feed caps, import/export, folders, tags, categories, search.

### D-2026-02-07-02
- Date: 2026-02-07
- Status: active
- Decision: Desktop uses a fixed 3-pane layout.
- Why: Keep browsing and reading visible at once.
- Details:
  - Pane 1: sidebar (`All articles` + flat feed list + `Add Feed`).
  - Pane 2: article list.
  - Pane 3: reader.
  - Sidebar is not collapsible.

### D-2026-02-07-03
- Date: 2026-02-07
- Status: active
- Decision: Mobile uses stacked views (`feeds -> articles -> reader`) with back navigation.
- Why: Preserve the same mental model while fitting small screens.

### D-2026-02-07-04
- Date: 2026-02-07
- Status: active
- Decision: Search is removed for MVP.
- Why: Reduce UI and state complexity.
- Notes: no search input, no search filter state, no search keyboard shortcuts.

### D-2026-02-07-05
- Date: 2026-02-07
- Status: active
- Decision: Folder UX and folder API actions are removed, but folder schema remains for now.
- Why: Avoid risky data migration during MVP while simplifying product behavior.
- Notes:
  - `feeds.folder_id` may exist in DB but is ignored by MVP UI.
  - Folder actions are not available from frontend or active API surface.

### D-2026-02-07-06
- Date: 2026-02-07
- Status: active
- Decision: Feed management in MVP is `add` and `delete` only.
- Why: Keep feed operations minimal and clear.
- Notes: rename/move are deferred.

### D-2026-02-07-07
- Date: 2026-02-07
- Status: active
- Decision: Reader renders feed-provided content only; full-article extraction is removed from MVP.
- Why: Keep MVP deterministic and avoid extraction inconsistencies/noise.
- Behavior:
  - Reader opens immediately with feed content.
  - No extraction runs in background.
  - Content shown is the feed item content after sanitization.

### D-2026-02-07-08
- Date: 2026-02-07
- Status: active
- Decision: Refresh is manual only.
- Why: Keep infrastructure simple in MVP.
- Notes: no schedulers, no background polling.

### D-2026-02-07-09
- Date: 2026-02-07
- Status: active
- Decision: Settings are account-only in MVP.
- Why: Remove setup/admin complexity from reading flow.
- Notes: import/export and billing UI are not part of the current product surface.

## Superseded decisions
- Any prior decision that required folders, search, OPML import/export, or billing in the MVP is superseded by D-2026-02-07-01 through D-2026-02-07-09.
