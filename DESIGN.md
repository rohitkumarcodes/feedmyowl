# FeedMyOwl Design Spec (MVP)

## 1. Design goal
Design for uninterrupted reading.

Every UI decision should reduce friction between the reader and the text.

## 2. Product shape
FeedMyOwl is a minimalist feed reader with a fixed information architecture.

### Desktop/tablet
Three visible panes:
1. Sidebar (`All articles`, flat feed list, `Add Feed`).
2. Article list.
3. Reader.

Rules:
- Sidebar is always visible.
- No collapsible shell behavior.
- No folder tree.

### Mobile
One pane at a time using stacked views:
1. Feeds view.
2. Articles view.
3. Reader view.

## 3. Information hierarchy
### Pane 1: Sidebar
Must include:
- Brand label.
- `All articles` scope.
- Feed rows (flat list).
- Add-feed action.
- Feed delete action.

Must not include:
- Search input.
- Folder controls.
- Category/tag controls.

### Pane 2: Article list
- Sorted newest-first.
- Shows title, source, relative time, snippet.
- Supports keyboard navigation.
- Uses calm empty states.

### Pane 3: Reader
- Full-width reading surface.
- Title, source, date/author metadata.
- Sanitized HTML rendering.
- Optional "Open original" link.

## 4. Interaction model
### Keyboard
- `j` / `ArrowDown`: next article.
- `k` / `ArrowUp`: previous article.
- `Enter`: open selected article.
- `r`: refresh feeds.

No search-specific shortcuts in MVP.

### Refresh behavior
- Manual refresh only.
- UI should clearly indicate when refresh is running.

### Add-feed behavior
- Input accepts a direct feed URL or a site URL.
- Backend first attempts direct feed parsing, then a conservative fallback discovery path.
- No candidate-picker UI or multi-step setup flow is added.

### Article rendering
- Reader renders feed-provided content directly.
- Rendering does not trigger full-article extraction.

## 5. Visual language
- Quiet, high-legibility typography.
- Light visual chrome around controls.
- Strong separation of panes with subtle borders.
- No decorative badges, pills, counters, or feature noise.

## 6. Content-first constraints
Do not add MVP UI for:
- Search.
- Folders.
- Tags/categories.
- Billing surfaces.
- Import/export tooling.

If a new UI element does not directly improve reading, remove it.

## 7. Accessibility baseline
- Clear focus states on interactive elements.
- Semantic landmarks for sidebar/list/reader regions.
- Keyboard flow must work without mouse.
- Reader title receives focus when an article opens.

## 8. Empty and error states
Use concise, calm language:
- Empty library: "Add a feed to get started."
- Empty feed: "No articles in this feed."
- Network unavailable: explain that previously loaded articles remain available.
- Refresh failures: show per-feed issue without blocking reading.

## 9. Implementation map
Primary files:
- `apps/web/src/components/feeds-workspace.tsx`
- `apps/web/src/components/Layout.tsx`
- `apps/web/src/components/Sidebar.tsx`
- `apps/web/src/components/ArticleList.tsx`
- `apps/web/src/components/ArticleReader.tsx`
- `apps/web/src/components/Toolbar.tsx`

## 10. Definition of done (design)
- Reading flow is clear on first use.
- No obsolete controls from removed features are visible.
- Desktop and mobile layouts preserve the same mental model.
- UI noise is lower than functionality offered.
