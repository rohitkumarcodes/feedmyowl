---
title: design system alignment across app and website
date: 2026-02-07
---

This release aligns both surfaces with the new typography-first design system.

## Web app

- Updated color and type tokens to match the project design spec.
- Simplified the three-pane layout and removed list-pane drag resizing.
- Moved add-feed behavior to a shared inline flow used by toolbar and sidebar.
- Refined reader typography with a narrow measure and serif body text.

## Website

- Rebuilt the public site styling around a single-column, reading-first layout.
- Added dedicated Docs and Changelog sections.
- Switched blog and changelog index pages to title-only streams.

This change keeps both products visually related while preserving their different jobs.

Follow-up: search and shortcut updates landed later in
[global article search and updated keyboard shortcuts](/changelog/global-search-and-shortcuts/).

Follow-up (2026-02-11): security and reliability hardening is now standard platform behavior: Manual refresh only (background jobs deferred), CSRF same-origin checks on mutating non-webhook routes, rate limits enforced with Redis/Upstash (fail-open if Redis unavailable), feed fetch hardening (SSRF blocking, redirect revalidation, timeout + retries), conditional fetch support (ETag / Last-Modified), and reliable dedupe with DB-backed GUID/fingerprint uniqueness.

Docs follow-up (2026-02-11): import/export guidance is now beginner-friendly in product docs, including OPML folder-path flattening (`/Tech/Web` -> `Tech / Web`) and a clear improvement roadmap (preview import, selective export, duplicate conflict controls, portable JSON v3, scheduled backups).

Follow-up (2026-02-12): add-feed behavior for site URLs is now more reliable. Discovery fallback now probes `www.<host>` candidates when needed, and submit failures surface explicit error notices instead of silent no-op interactions.
