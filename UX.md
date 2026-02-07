# FeedMyOwl UX Spec (MVP)

## 1. Core user story
"I want to quickly read updates from feeds in one calm place."

The product should support this story with minimal setup and minimal UI overhead.

## 2. Primary user flow
1. User opens `/feeds`.
2. If no subscriptions, user adds a feed URL.
3. User refreshes feeds.
4. User selects a scope (`All articles` or one feed).
5. User selects an article.
6. User reads in the reader pane.

## 3. Desktop UX
Three panes are visible at once:
1. Sidebar: scope and feed selection.
2. Article list: selectable rows.
3. Reader: article content.

Expected behavior:
- Selecting scope updates article list.
- Selecting article opens reader and marks item read.
- Reader attempts full-article extraction in background.
- Sidebar remains visible; no hide/show mode.

## 4. Mobile UX
Stacked navigation:
- View 1: feeds.
- View 2: article list.
- View 3: reader.

Expected behavior:
- Navigating forward pushes view state.
- Browser back returns to previous view.
- Context labels make current scope obvious.

## 5. Sidebar behavior
Sidebar includes only:
- `All articles`.
- Flat feed list.
- `+ Add Feed`.
- Feed delete action.

No folders, no grouping, no tags, no search.

## 6. Reader behavior
- Opened article renders immediately from available feed content.
- Extraction runs automatically when applicable.
- If extraction succeeds, richer content appears.
- If extraction fails, reading continues on fallback content.
- "Open original" remains available when article link exists.

## 7. Empty states
- No feeds: "Add a feed to get started."
- No items in selected feed: "No articles in this feed."
- No items globally: "No articles yet. Refresh to load the latest posts."

## 8. Error handling
- Keep language calm and specific.
- Prefer inline messages over blocking UI.
- Do not block reading because one feed fails refresh.

## 9. Keyboard UX
- `j` and `k` move list selection.
- `Enter` opens selected article.
- `r` triggers refresh.

No keyboard behavior for removed features.

## 10. Accessibility UX
- Focus visible on all actionable controls.
- Logical tab order through sidebar, list, reader, toolbar.
- Reader title is focus target after opening an article.
- Region labels should be meaningful for assistive tech.

## 11. Deliberately excluded UX
Do not add in this MVP:
- Search workflows.
- Organizational workflows (folders/tags/categories).
- Billing and plan-management flows.
- Import/export flows.

## 12. MVP UX acceptance checklist
- First-time user can add feed and start reading without docs.
- Desktop flow works end-to-end with three panes.
- Mobile flow works end-to-end with view stack/back behavior.
- No obsolete controls are visible.
