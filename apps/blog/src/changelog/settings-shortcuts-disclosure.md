---
title: settings keyboard shortcuts moved into disclosure panel
date: 2026-02-10
---

This release updates the Settings shortcuts section to reduce clutter while keeping shortcut help easy to access.

## Web app

- Added a collapsed-by-default shortcuts toggle under `Keyboard shortcuts`.
- Toggle icon order is caret first, then keyboard icon.
- Expanded panel opens with shutter motion.
- Expanded content uses grouped shortcut rows in a boxed layout.
- Toggle button width is aligned to the expanded panel width.

## Docs

- Updated markdown product docs and runbook to reflect settings shortcut panel behavior.

Follow-up (2026-02-11): security/reliability hardening is now documented as platform baseline: Manual refresh only (background jobs deferred), CSRF same-origin checks on mutating non-webhook routes, rate limits enforced with Redis/Upstash (fail-open if Redis unavailable), feed fetch hardening (SSRF blocking, redirect revalidation, timeout + retries), conditional fetch support (ETag / Last-Modified), and reliable dedupe with DB-level GUID/fingerprint uniqueness.

Docs follow-up (2026-02-11): import/export docs are now written in beginner-friendly language, with explicit OPML folder mapping examples and a clear backlog for import preview, selective export, duplicate controls, JSON v3 portability, and scheduled backups.

Follow-up (2026-02-12): add-feed site URL handling is now documented as deterministic with `www.<host>` fallback probing and explicit user-facing error notices when submit fails unexpectedly.
