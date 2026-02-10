---
title: global article search and updated keyboard shortcuts
date: 2026-02-10
---

This release adds global fuzzy search to the feeds workspace and updates keyboard behavior to support it.

## Web app

- Added always-visible article search in the article list pane.
- Search activates at 2+ characters and runs fuzzy matching across loaded articles.
- Active search is global, ranked by relevance then recency, and capped to top 50 results.
- Added title/feed match highlighting in search results.
- Added `/` keyboard shortcut to focus search input.
- Updated `Escape` behavior so it clears the search query when the search input is focused.

## Docs

- Updated markdown product docs (`FEEDMYOWL_PROJECT_CONTEXT`, `DESIGN`, `UX`, `RUNBOOK`, `DECISION_LOG`) to reflect new search behavior and shortcut map.
- Updated public `/docs/` keyboard guidance and added a dedicated article-search section.
