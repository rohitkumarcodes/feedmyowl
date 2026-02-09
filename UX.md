# FeedMyOwl UX Spec

## 1. Core user story
"I want to read my feeds in one calm place, organized into folders when needed."

## 2. Primary user flow
1. Open `/feeds`.
2. Add a feed URL or site URL.
3. Optionally assign one or more folders during add.
4. Refresh feeds.
5. Choose scope (`Read all`, `Uncategorized`, folder, or feed).
6. Open and read an article.

## 3. Sidebar behavior
- Top controls:
  - `Read all feeds`
  - `Uncategorized`
  - `Refresh feeds`
  - `Add a feed`
  - `New folder`
- Sections:
  - Uncategorized feed rows
  - Folders section with collapsible folder rows
  - Feed rows under each folder (feeds may appear in multiple folders)

## 4. Folder behavior
- Create folders from sidebar and add-feed form.
- Rename and delete folders from folder row actions.
- Delete dialog offers:
  - Delete folder only.
  - Delete folder and unsubscribe exclusive feeds.
- Dialog shows total, exclusive, and cross-listed feed counts.

## 5. Add-feed behavior
- Add form includes:
  - Input mode toggle: `Single URL` or `Paste many`.
  - Feed/site URL input (single mode).
  - Newline-separated URL textarea (bulk mode).
  - Folder multi-select.
  - Inline folder creation.
- URL handling:
  - Missing scheme auto-normalizes to `https://`.
  - Do not auto-add `www` or infer TLDs.
- Discovery flow:
  - Single add runs `discover` then `create`.
  - If exactly one addable feed is found, add proceeds automatically.
  - If multiple addable feeds are found, user must choose one before create.
  - If none are valid, show: `Error: We couldn't find any feed at this URL. Contact site owner and ask for the feed link.`
- Progress and feedback:
  - Stage messages: normalizing, discovering, awaiting selection, creating.
  - Inline duplicate hint disables submit for exact URL duplicates.
  - Successful single add closes form by default and offers `Add another`.
- Bulk behavior:
  - Rows are processed sequentially.
  - Rows with multiple discovered feeds fail with: `Multiple feeds found; add this URL individually to choose one.`
  - Summary shows imported, duplicate, failed counts and top failures.
- Default without assignments is Uncategorized.

## 6. Scope behavior
- `Read all`: all articles.
- `Uncategorized`: only feeds with no folder assignments.
- Folder scope: union of feeds in that folder.
- Feed scope: only that feed’s articles.

## 7. Mobile UX
- Keep stacked views: `Feeds -> Articles -> Reader`.
- Feeds view mirrors desktop information architecture, including folders.
- Folder and feed selection enters article list view with scoped title.

## 8. Accessibility
- Folder expand controls use `aria-expanded`.
- Overflow menus and dialogs dismiss with `Escape`.
- Existing shortcuts remain:
  - `j`, `k`, `Enter`, `r`.
