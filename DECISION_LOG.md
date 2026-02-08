# FeedMyOwl Decision Log

This log records active product and technical decisions for the current app phase.

## How to read this file
- Status values: `active` or `superseded`.
- Date format: `YYYY-MM-DD`.

## Active decisions

### D-2026-02-07-01
- Date: 2026-02-07
- Status: active
- Decision: FeedMyOwl remains reading-first.
- Why: Keep the core add -> refresh -> read flow calm and reliable.

### D-2026-02-08-02
- Date: 2026-02-08
- Status: active
- Decision: Folders are reintroduced as multi-assignment organization.
- Why: Users need lightweight feed organization without changing the reading model.
- Details:
  - A feed may belong to multiple folders.
  - Uncategorized means a feed has zero folder assignments.
  - Sidebar shows feeds under every assigned folder.

### D-2026-02-08-03
- Date: 2026-02-08
- Status: active
- Decision: Sidebar scopes include `Read all feeds`, `Uncategorized`, folder scopes, and feed scopes.
- Why: Keep navigation explicit and scannable.

### D-2026-02-08-04
- Date: 2026-02-08
- Status: active
- Decision: Add-feed includes optional folder assignment and inline folder creation.
- Why: Reduce post-create cleanup work.

### D-2026-02-08-05
- Date: 2026-02-08
- Status: active
- Decision: Folder delete offers two modes.
- Why: Users need both safe cleanup and destructive cleanup.
- Modes:
  - `remove_only`: delete folder and remove membership links only.
  - `remove_and_unsubscribe_exclusive`: unsubscribe only feeds exclusive to that folder; keep cross-listed feeds.

### D-2026-02-08-06
- Date: 2026-02-08
- Status: active
- Decision: Existing keyboard shortcuts remain unchanged (`j`, `k`, `Enter`, `r`).
- Why: Preserve reading interaction consistency.

## Superseded decisions

### D-2026-02-07-05
- Date: 2026-02-07
- Status: superseded
- Decision: Folder UX and folder API actions are removed.
- Superseded by: D-2026-02-08-02 through D-2026-02-08-05.
