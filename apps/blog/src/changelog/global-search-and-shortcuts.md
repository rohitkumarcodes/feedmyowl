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

Follow-up (2026-02-11): platform hardening for feed writes/fetches is now in place, including Manual refresh only (background jobs deferred), CSRF same-origin checks on mutating non-webhook routes, rate limits enforced with Redis/Upstash (fail-open if Redis unavailable), feed fetch hardening (SSRF blocking, redirect revalidation, timeout + retries), conditional fetch support (ETag / Last-Modified), and reliable dedupe with DB uniqueness.

Docs follow-up (2026-02-11): import/export docs now use beginner-friendly language and cover OPML folder behavior clearly, including flat folder mapping for category paths and the planned roadmap for safer migration features.

Follow-up (2026-02-12): add-feed discovery docs were updated to reflect deterministic fallback behavior for site URLs, including `www.<host>` probing and explicit error notices for unexpected submit failures.
