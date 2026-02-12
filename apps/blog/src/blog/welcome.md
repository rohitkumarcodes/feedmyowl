---
title: welcome to feedmyowl
date: 2026-02-06
description: Why feedmyowl exists and what it does.
---

feedmyowl is built for focused reading.

Most feed readers optimize for engagement. feedmyowl does not.

## what feedmyowl does

- Fetches RSS and Atom feeds when you ask it to.
- Shows articles in a clean interface designed for reading.
- Lets you fuzzy-search loaded articles directly in the reading workspace.
- Keeps controls and visual noise to a minimum.
- Imports feed files and keeps folder organization in a single-level model.
- Exports your feed library so you can move or back up your subscriptions.

## what feedmyowl avoids

- No push notifications.
- No unread badges or counts.
- No recommendation engine.
- No social features.

As of 2026-02-11, feedmyowl ships with hardened defaults: Manual refresh only (background jobs deferred). Feed fetch hardening includes SSRF blocking, redirect revalidation, timeout + retries, plus conditional fetch support (ETag / Last-Modified) and reliable dedupe (GUID + content fingerprint with DB uniqueness).

As of 2026-02-12, add-feed discovery is more deterministic for site URLs: if a non-`www` host fails, feed discovery also probes `www.<host>` candidates, and add attempts now surface explicit errors instead of appearing to do nothing.

## import and export (beginner friendly)

- Import supports OPML/XML and FeedMyOwl JSON.
- If your OPML file uses folder paths like `/Tech/Web`, feedmyowl flattens that into one folder label: `Tech / Web`.
- If one imported feed belongs to multiple folder paths, it can be assigned to multiple folders.
- Upcoming improvements include: preview-before-import, selective export, clearer duplicate rules, richer portable JSON, and scheduled backups.

The goal is simple: help you read without distraction.

[open app ↗]({{ metadata.appUrl }})
