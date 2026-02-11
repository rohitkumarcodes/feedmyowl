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

Follow-up (2026-02-11): the feed pipeline now runs with hardened reliability/security defaults: Manual refresh only (background jobs deferred), CSRF same-origin checks on mutating non-webhook routes, rate limits enforced with Redis/Upstash (fail-open if Redis unavailable), feed fetch hardening (SSRF blocking, redirect revalidation, timeout + retries), conditional fetch support (ETag / Last-Modified), and reliable dedupe with DB-backed GUID/fingerprint uniqueness.

Docs follow-up (2026-02-11): import/export documentation is updated in beginner-friendly language, including how OPML folder/category paths map into FeedMyOwl's single-level folder labels and what migration features are planned next.
