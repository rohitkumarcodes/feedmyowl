---
title: search typo fallback and highlight precision
date: 2026-02-11
---

This release improves article search trust while restoring typo recovery for common mistakes.

## Web app

- Search remains strict-first for global results and keeps significant contiguous matches only.
- Added typo fallback when strict search returns no results for 4+ character queries.
- Typo fallback uses one-edit matching on title/feed-title tokens (for example `heaet` -> `heart`).
- Fallback highlights the full matched token to avoid fragmented text highlights.
- Search still caps rendered results to top 50.
- Search result source labels now reflect significant hidden-field matches (`Matched in snippet` / `Matched in author`).

## UI polish

- Keyboard shortcuts modal width on desktop/tablet now adapts to the longest shortcut row
  while remaining capped to viewport width.
