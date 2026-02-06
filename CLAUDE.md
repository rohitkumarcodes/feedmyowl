# FEEDMYOWL — Instructions for Claude Code

> **This file governs all UI/UX and frontend implementation work.** Read it in full before writing any code. It is subordinate to `FEEDMYOWL_PROJECT_CONTEXT.md` — if anything here conflicts with the project context, the project context wins.

---

## Project Summary

FeedMyOwl is a minimalist RSS/Atom feed reader. Its mission is to **preserve the attention of the reader** by providing a calm, focused, distraction-free reading experience. The guiding question for every decision is: **"Does this help the user read better, or does it distract them?"**

The founder is not a professional programmer. All code must be heavily commented, simple, and maintainable by someone working with AI assistance.

## Tech Stack (do not change)

- **Monorepo:** pnpm workspaces (`apps/` directory)
- **Frontend:** Next.js + React + TypeScript (strict mode)
- **Hosting:** Vercel
- **Database:** PostgreSQL on Neon
- **Auth:** Clerk
- **Styling:** CSS Modules or plain CSS. **No Tailwind. No CSS-in-JS libraries.**
- If CSS Modules are already in use, continue with them. Otherwise, prefer a global stylesheet for tokens/variables plus colocated `.module.css` files per component.

## Design References

| Reference | What we take from it |
|---|---|
| **NetNewsWire** (Mac/iOS RSS reader) | Three-pane layout structure, keyboard navigation patterns, the general *shape* of a feed reader — but NOT its unread-count-driven interaction model |
| **flashcasts.com** | Content hierarchy, section header styling (small, uppercase, muted), spare typography, list density, content-first ethos |
| **sr.ht / SourceHut** | Color palette, surface treatment, brutalist temperament, no-nonsense nav, shades-of-gray appearance, conservative color usage |

Each reference governs a specific layer. Do not blend them arbitrarily.

---

## 1. Interaction Philosophy

FeedMyOwl deliberately rejects the anxiety-driven patterns of most feed readers:

- **No unread counts.** No numbers next to feeds. No badges. No "All Unread" smart feed. These create compulsive checking behavior.
- **No push notifications.** No background polling. Feeds are fetched only when the user presses Refresh.
- **No starred/bookmarked articles.** FeedMyOwl is not a "read later" service or content archive.
- **No social features.** No sharing, no comments, no likes.

The only concession to read-tracking: articles the user has already opened are **visually muted** (reduced opacity or lighter text color) so the user can orient themselves in a list. This is a wayfinding aid, not a productivity metric. There is no count of how many remain.

---

## 2. Layout (informed by NetNewsWire's three-pane structure)

The app uses a **three-pane layout**, left to right, filling the viewport height (`100vh`). This is a single-page interface — feed changes and article selection are state changes, not route changes.

### Pane 1 — Sidebar (Feeds)

- Fixed width, collapsible (keyboard: `Cmd+Shift+S` or a toggle button)
- Default width: ~240px
- Contents from top to bottom:
  1. **App name** as plain text: "FEEDMYOWL" — small caps or uppercase, muted color, not a logo or image
  2. **Folders** that expand/collapse (disclosure triangle ▶/▾), containing individual feeds
  3. **Uncategorized feeds** at the bottom (feeds not assigned to any folder)
  4. An **"Add Feed" affordance** at the bottom — a plain `+` character or text link, not a styled button
- **Folder headers** styled like flashcasts.com's category headers: small, uppercase, letter-spaced (`0.05em`), muted color (`var(--text-muted)`)
- Each feed row: feed name only (truncated with ellipsis if needed). **No unread count. No badge. No number.**
- Active/selected feed: subtle left border (`2px solid var(--accent)`) or light background tint — not a heavy highlight
- Right-click context menu on feeds/folders: Rename, Delete, Move to Folder

### Pane 2 — Article List

- Flexible width, minimum ~280px
- Dense vertical list. Each row contains:
  - **Article title** — semibold for unread, normal weight for read (this is the only read/unread signal)
  - **Source name + relative timestamp** on one line (muted, smaller, e.g., "Daring Fireball · 3h ago")
  - **1-line snippet** from the article body (muted, smaller, truncated with ellipsis)
- **Read/unread visual treatment:** Articles the user has opened are displayed with `var(--text-secondary)` text color and `font-weight: var(--weight-normal)`. Unopened articles use `var(--text-primary)` and `font-weight: var(--weight-semibold)`. That is the only difference. No dots, no icons, no badges.
- Clicking a row selects it (subtle background highlight) and loads the article in Pane 3. Clicking also marks the article as read.
- Dividers: `1px solid var(--border)` between rows, OR vertical spacing only — not both.
- Sort: newest first by default.

### Pane 3 — Article Reader

- Takes remaining horizontal space, scrolls independently
- Content constrained to `max-width: 65ch`, centered within the pane
- Layout from top to bottom:
  1. **Feed name** (muted, small)
  2. **Article title** as `<h1>`
  3. **Author + publication date** (muted, small)
  4. **Article body** — rendered as sanitized HTML (use DOMPurify)
  5. **"Open original ↗"** — a plain text link at the bottom, not a button
- Images in articles: `max-width: 100%`, no borders, no shadows
- Code blocks: light gray background (`var(--bg-secondary)`), monospace, `overflow-x: auto`
- When no article is selected: a single centered line of muted text — "Select an article to read"

### Toolbar

- A thin bar above the three panes (or integrated into the sidebar header area)
- Contains only:
  - **Refresh button** (`⟳` or the word "Refresh") — fetches all feeds when clicked
  - **Search input** — plain text input, no icon inside it, filters the current article list
  - **Add Feed** (`+`) — opens an inline form, not a modal
- Style: light background matching sidebar, items are plain text or minimal inline SVGs
- No breadcrumbs, no tabs, no navigation that duplicates the sidebar

---

## 3. Search Behavior

- The search input in the toolbar filters the **currently visible article list** (whichever feed or folder is selected in the sidebar).
- Filtering is client-side, matching against article title and snippet text.
- Search is instant (filter on keystroke, debounced ~150ms).
- When the search field is non-empty, only matching articles are shown in the article list.
- Pressing `Escape` clears the search and restores the full list.
- No full-text search of article bodies in the MVP. Just title + snippet matching.
- No separate search results page or view — filtering happens in place within Pane 2.

---

## 4. Visual Design System (from flashcasts.com + sr.ht)

### Philosophy

Brutalist, content-first, typographically clean. The interface should look like it was designed by someone who reads Tufte and uses SourceHut. Every element must earn its pixel. When in doubt, remove rather than add.

### Color Palette (define as CSS custom properties in `:root`)

```css
:root {
  /* Light mode */
  --bg-primary: #ffffff;
  --bg-secondary: #f5f5f3;       /* sidebar, toolbar */
  --bg-tertiary: #e8e8e8;        /* hover states */
  --bg-selected: #e8f0fe;        /* selected article row */
  --text-primary: #222222;
  --text-secondary: #666666;     /* read articles, secondary info */
  --text-muted: #999999;         /* timestamps, section headers */
  --border: #e0e0e0;
  --accent: #0366d6;             /* links, selected feed indicator */
}

@media (prefers-color-scheme: dark) {
  :root {
    --bg-primary: #1a1a1a;
    --bg-secondary: #222222;
    --bg-tertiary: #2a2a2a;
    --bg-selected: #1e2a3a;
    --text-primary: #d0d0d0;
    --text-secondary: #999999;
    --text-muted: #666666;
    --border: #333333;
    --accent: #58a6ff;
  }
}
```

These are the **only** colors in the application. Do not introduce others.

### Typography

```css
:root {
  --font-sans: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto,
               "Helvetica Neue", Arial, sans-serif;
  --font-mono: "SF Mono", "Fira Code", Consolas, "Liberation Mono",
               Menlo, monospace;

  /* Type scale */
  --text-xs: 0.75rem;      /* 12px — timestamps, section headers */
  --text-sm: 0.8125rem;    /* 13px — snippets, secondary info */
  --text-base: 0.9375rem;  /* 15px — sidebar items, article list titles */
  --text-lg: 1.0625rem;    /* 17px — article reader body */
  --text-xl: 1.5rem;       /* 24px — article title in reader pane */

  /* Line heights */
  --leading-tight: 1.3;
  --leading-normal: 1.5;
  --leading-relaxed: 1.65; /* article reader body */

  /* Weights — ONLY these two, never any others */
  --weight-normal: 400;
  --weight-semibold: 600;
}
```

- System font stack everywhere. No Google Fonts. No web font loading.
- **Only two font weights: 400 and 600.** Never use `font-weight: bold`, `700`, or `300`.
- Section headers in sidebar: `var(--text-xs)`, `uppercase`, `letter-spacing: 0.05em`, `color: var(--text-muted)`
- Timestamps: `font-variant-numeric: tabular-nums`

### Spacing

- Base unit: **4px**. All spacing values must be multiples of 4.
- Sidebar item padding: `6px 12px`
- Article list row padding: `10px 12px`
- Article reader content padding: `24px 32px`
- Gap between sidebar sections: `16px`
- No spacing value larger than `48px` anywhere in the UI

### Borders & Surfaces

- Pane dividers: `1px solid var(--border)`
- Border-radius: **2px maximum**, only on input fields and buttons. Everything else is square.
- **No box-shadows.** None. Zero. Not even "subtle" ones.
- **No gradients.**
- **No backdrop-filter / blur effects.**

### Interactive States

```css
/* Hover — subtle and immediate */
.hoverable:hover {
  background-color: var(--bg-tertiary);
  transition: background-color 80ms ease;
}

/* Focus — accessible and visible */
.focusable:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

/* No transitions longer than 100ms. No keyframe animations. */
```

### Buttons & Controls

- Buttons look like text links or have `1px solid var(--border)` with transparent background.
- **No filled/primary buttons with colored backgrounds.** Ever.
- Input fields: `1px solid var(--border)`, `padding: 6px 10px`, `border-radius: 2px`, transparent background
- The Refresh button does not need to look "important" — it's just another control in the toolbar.

---

## 5. Keyboard Shortcuts

| Key | Action |
|---|---|
| `j` / `↓` | Next article in list |
| `k` / `↑` | Previous article in list |
| `Enter` | Open selected article in reader pane |
| `r` | Refresh all feeds |
| `/` | Focus search input |
| `Escape` | Clear search / blur search input |
| `Cmd+Shift+S` | Toggle sidebar visibility |

Implementation: use a `useKeyboardShortcuts` custom hook with a `keydown` listener on `document`. Disable shortcuts when an input or textarea is focused (except `Escape`).

---

## 6. React / Next.js Implementation Notes

### Component Structure

One component per file, small and composable:

```
components/
  Layout.tsx              — the three-pane shell
  Sidebar.tsx             — sidebar container
  FolderGroup.tsx         — a folder with its child feeds
  FeedItem.tsx            — a single feed in the sidebar
  ArticleList.tsx         — the middle pane
  ArticleRow.tsx          — a single article in the list
  ArticleReader.tsx       — the right pane
  Toolbar.tsx             — top bar with refresh, search, add feed
  AddFeedForm.tsx         — inline form for adding a new feed
```

Each `.tsx` file has a colocated `.module.css` file with the same name.

### State Management

- Use React context + `useReducer` for feed/article state, or whatever is already in place.
- **Do not add Redux, Zustand, Jotai, or any state management library** unless already present.
- Feed data and article data come from the database via API routes. Client state manages which feed is selected, which article is open, and search filter text.

### Key Implementation Details

- **Sanitize article HTML:** Use DOMPurify. Render with `dangerouslySetInnerHTML` after sanitizing.
- **Relative timestamps:** Write a small `timeAgo(date: Date): string` utility. Do not install date-fns, dayjs, or moment for this.
- **Feed refresh:** Calls a Next.js API route that fetches all the user's subscribed feeds using rss-parser, stores new articles in the database, and returns updated data. The Refresh button should show "Refreshing..." text (not a spinner) while the request is in flight.
- **Adding feeds:** An inline form that expands in place (below the toolbar or at the bottom of the sidebar). Not a modal. The form has one input (URL) and a submit button.
- **Collapsible sidebar:** Toggle a CSS class that sets `display: none` or `width: 0` with `overflow: hidden`. No animation.
- **No client-side routing transitions.** The three-pane layout is a single page.

### Code Conventions

- TypeScript strict mode. No `any` types.
- All colors and spacing via CSS custom properties (defined once in a global `:root` block).
- Component files: `PascalCase.tsx` with colocated `PascalCase.module.css`
- Utility functions: `camelCase.ts` in a `utils/` directory
- **Every file and every exported function must have a comment explaining what it does** — the founder may not remember weeks later.
- Commit messages: conventional commits (`feat:`, `fix:`, `refactor:`, `style:`)

---

## 7. Constraints — DO NOT DO THESE

This section is critical. These are the patterns that will ruin the design and violate the project's principles.

### Visual / CSS

- ❌ No Tailwind CSS. Do not install it. Write real CSS.
- ❌ No icon libraries (FontAwesome, Heroicons, Lucide, Phosphor, etc.). Use unicode glyphs (▶ ▾ ⟳ + ↗) or hand-written inline SVGs (stroke only, no fill, 1.5px stroke).
- ❌ No component libraries (shadcn, Radix, Chakra, MUI, Ant Design). Build UI elements from scratch — there are very few of them.
- ❌ No `border-radius` greater than `2px`. No pill shapes, no circles on buttons.
- ❌ No `box-shadow` anywhere.
- ❌ No gradients, blurs, or glassmorphism.
- ❌ No CSS animations or transitions longer than 100ms.
- ❌ No `font-weight: 700` or `bold`. Maximum is `600` (semibold).
- ❌ No `!important` unless overriding third-party styles.

### Interaction / UX

- ❌ No unread counts, badges, or numbers next to feeds. The project explicitly forbids these.
- ❌ No "Smart Feeds" (Today, All Unread, Starred). These are attention-anxiety patterns.
- ❌ No starred/bookmarked articles. FeedMyOwl is not a read-later service.
- ❌ No modals or dialogs. Use inline forms or dropdown panels.
- ❌ No toast notifications. Show status inline where the action happened.
- ❌ No skeleton loading screens. Plain text "Loading..." is correct.
- ❌ No empty state illustrations. One line of muted text is correct.
- ❌ No onboarding, tutorials, welcome screens, or coach marks.
- ❌ No hamburger menu. Sidebar is always available on desktop.

### Technical

- ❌ **Do not install new npm dependencies** without explicit approval from the founder. Everything in this spec is achievable with what's already available plus DOMPurify.
- ❌ Do not create new API routes without explicit approval. Use the existing route structure in the project.
- ❌ Do not modify `lib/auth.ts`, `lib/payments.ts`, `lib/database.ts`, `lib/email.ts`, `lib/feed-parser.ts`, or `lib/error-tracking.ts` module boundaries — these are the service abstraction layers (Principle 4).

---

## 8. Quality Checklist

Before committing any UI code, ask:

1. "Does this help the user **read better**, or does it distract them?" (Principle 7)
2. "Could this element exist on SourceHut without looking out of place?"
3. "Is this visually heavier than flashcasts.com's category lists? If yes, strip it down."
4. "If I removed this element entirely, would anything break? If no, remove it." (Principle 6)
5. "Is every function and file commented so the founder can understand it weeks later?" (Principle 8)
6. "Am I introducing a new dependency? If so, stop and ask." (Principle 3, Principle 6)

The finished product should feel like a calm, native-quality tool — fast, dense, quiet, and typographically confident. Not a SaaS product. Not a startup landing page. **A reading tool that respects your attention.**
