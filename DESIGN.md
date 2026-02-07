# FEEDMYOWL — Design Specification

> **This file governs all UI/UX, visual design, and frontend implementation work across both the webapp (app.feedmyowl.com) and the website (feedmyowl.com).** Read it in full before writing any code. It is subordinate to `FEEDMYOWL_PROJECT_CONTEXT.md` — if anything here conflicts with the project context, the project context wins.

---

## Project Summary

FeedMyOwl is a minimalist RSS/Atom feed reader. Its mission is to **preserve the attention of the reader** by providing a calm, focused, distraction-free reading experience. The guiding question for every decision is: **"Does this help the user read better, or does it distract them?"**

The project has two public-facing parts:

- **The webapp** at `app.feedmyowl.com` — the feed reader itself. A single-page three-pane interface for subscribing to and reading RSS/Atom feeds.
- **The website** at `feedmyowl.com` — the public-facing site built with 11ty. Landing page, blog, docs, changelog, and any other public content.

Both parts share a single design philosophy. The webapp applies it to a dense, functional reading tool. The website applies it to a spacious, long-form reading experience. They should feel like they belong to the same family without being visually identical.

The founder is not a professional programmer. All code must be heavily commented, simple, and maintainable by someone working with AI assistance.

---

## Tech Stack (do not change)

- **Monorepo:** pnpm workspaces (`apps/` directory)
- **Frontend:** Next.js + React + TypeScript (strict mode)
- **Hosting:** Vercel
- **Database:** PostgreSQL on Neon
- **Auth:** Clerk
- **Styling:** CSS Modules or plain CSS. **No Tailwind. No CSS-in-JS libraries.**
- If CSS Modules are already in use, continue with them. Otherwise, prefer a global stylesheet for tokens/variables plus colocated `.module.css` files per component.

---

## Design References

| Reference | What we take from it |
|---|---|
| **NetNewsWire** (Mac/iOS RSS reader) | Three-pane layout structure, keyboard navigation patterns, the general *shape* of a feed reader — but NOT its unread-count-driven interaction model |
| **seths.blog** (Seth Godin's blog) | The *taste* of the entire project. Typography-first design where the text IS the interface. Narrow readable measure, generous structural whitespace, near-invisible metadata, warm near-monochrome palette, zero visual chrome. Content flows as a continuous vertical river — no cards, no grids, no truncation. The design sensibility of someone who believes the words are the product and everything else should get out of the way. |

NetNewsWire governs the **structural shape** of the webapp (three panes, keyboard-driven navigation). seths.blog governs the **visual and typographic taste** of everything — the webapp's reading pane, the website, and every surface where the user encounters text.

---

## Design Philosophy

This project is a **reading environment**, not a dashboard and not a SaaS product. Every design decision should serve the act of reading prose comfortably for extended periods.

The mental model is a **book page**, not a web app. When you encounter a decision this document doesn't cover, ask: "What would a well-typeset book do here?" and do that.

### What seths.blog gets right (and we borrow)

These are the specific qualities of seths.blog that define our taste. They are listed here so that any person or LLM working on this project can understand not just what the design looks like, but *why* it works.

1. **The text is the interface.** There is almost zero visual chrome — no hero images, no gradients, no cards with shadows, no icons decorating things. The words on the page are the entire experience.

2. **Narrow, readable measure.** The text column is constrained to a comfortable reading width (~35–40em, roughly 65–75 characters per line). This is a book page, not a wide content area with cards.

3. **Generous whitespace used structurally.** Space between elements is generous but purposeful. The whitespace creates hierarchy and separation without needing lines, boxes, or color blocks.

4. **Minimal, almost invisible metadata.** Dates exist but are quiet — small, understated, pushed to the periphery. There are no author avatars, no category tags, no read-time estimates, no share buttons, no comment counts. The metadata that *does not exist* is as important as the content that does.

5. **Content flows continuously.** The homepage is not a grid of cards. It is a vertical river of content, one piece after another. You scroll and read. It is closer to a printed newspaper column or a journal than to a "feed."

6. **Typographic hierarchy through size and weight alone.** Headings are larger and linked. Body text is comfortable. Italics are used for emphasis within prose. That is the entire system. No colored badges, no underlines on everything, no uppercase labels.

7. **Warm but nearly monochrome palette.** Black text on white/off-white background. One quiet accent color for links. The warmth comes from the type choices and spacing, not from color.

8. **The sidebar is a quiet reference shelf.** Simple text links, grouped logically. No widgets, no "trending" anything, no animation.

---

## 1. Interaction Philosophy

FeedMyOwl deliberately rejects the anxiety-driven patterns of most feed readers:

- **No unread counts.** No numbers next to feeds. No badges. No "All Unread" smart feed. These create compulsive checking behavior.
- **No push notifications.** No background polling. Feeds are fetched only when the user presses Refresh.
- **No starred/bookmarked articles.** FeedMyOwl is not a "read later" service or content archive.
- **No social features.** No sharing, no comments, no likes.

The only concession to read-tracking: articles the user has already opened are **visually muted** (reduced opacity or lighter text color) so the user can orient themselves in a list. This is a wayfinding aid, not a productivity metric. There is no count of how many remain.

---

## 2. Webapp Layout (app.feedmyowl.com)

The webapp uses a **three-pane layout**, left to right, filling the viewport height (`100vh`). The structure is informed by NetNewsWire. This is a single-page interface — feed changes and article selection are state changes, not route changes.

### Pane 1 — Sidebar (Feeds)

- Fixed width, collapsible (keyboard: `Cmd+Shift+S` or a toggle button)
- Default width: ~240px
- Contents from top to bottom:
  1. **App name** as plain text: "FEEDMYOWL" — small caps or uppercase, muted color, not a logo or image
  2. **Folders** that expand/collapse (disclosure triangle ▶/▾), containing individual feeds
  3. **Uncategorized feeds** at the bottom (feeds not assigned to any folder)
  4. An **"Add Feed" affordance** at the bottom — a plain `+` character or text link, not a styled button
- **Folder headers:** small, uppercase, letter-spaced (`0.05em`), muted color (`var(--text-muted)`). Quiet section labels, not attention-seeking.
- Each feed row: feed name only (truncated with ellipsis if needed). **No unread count. No badge. No number.**
- Active/selected feed: subtle left border (`2px solid var(--accent)`) or light background tint — not a heavy highlight
- Right-click context menu on feeds/folders: Rename, Delete, Move to Folder
- The sidebar should feel like the table of contents in a book — a quiet reference shelf that helps you navigate, not a dashboard demanding attention.

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

This is the most important pane. It is where the user spends most of their time. Its design should feel like reading seths.blog — the text is the interface, everything else recedes.

- Takes remaining horizontal space, scrolls independently
- Content constrained to `max-width: 38em` (~65–75 characters per line), centered within the pane
- Generous vertical padding: the text should never feel crowded against the edges of the pane
- Layout from top to bottom:
  1. **Feed name** (muted, small — almost invisible, like a dateline)
  2. **Article title** as `<h1>` — large enough to anchor the page, but not shouting
  3. **Author + publication date** (muted, small, quiet — the reader should be able to ignore these entirely)
  4. **Article body** — rendered as sanitized HTML (use DOMPurify). This is the heart of the app. The body text must be comfortable to read for extended periods: 17–19px, line-height 1.6–1.7, generous paragraph spacing.
  5. **"Open original ↗"** — a plain text link at the bottom, not a button
- Images in articles: `max-width: 100%`, no borders, no shadows
- Code blocks: light gray background (`var(--bg-secondary)`), monospace, `overflow-x: auto`
- When no article is selected: a single centered line of muted text — "Select an article to read"
- Article body paragraphs should have generous spacing between them (at least 1em margin-bottom). Text should breathe.

### Toolbar

- A thin bar above the three panes (or integrated into the sidebar header area)
- Contains only:
  - **Refresh button** (`⟳` or the word "Refresh") — fetches all feeds when clicked
  - **Search input** — plain text input, no icon inside it, filters the current article list
  - **Add Feed** (`+`) — opens an inline form, not a modal
- Style: light background matching sidebar, items are plain text or minimal inline SVGs
- No breadcrumbs, no tabs, no navigation that duplicates the sidebar

---

## 3. Website Layout (feedmyowl.com)

The website at feedmyowl.com is the public face of the project — the landing page, blog, docs, and changelog. It is built with 11ty. Its design should be the purest expression of the seths.blog aesthetic because it is entirely a reading experience with no app chrome.

### Core Principles for the Website

- **Single-column, narrow measure.** All text content constrained to `max-width: 38em`, centered on the page. No multi-column layouts. No sidebars on content pages.
- **The text is the product.** No hero images, no illustrations, no stock photography, no decorative SVGs. If an image is present, it is there because the content requires it.
- **Continuous vertical flow.** On the blog index, posts are displayed in a vertical stream — title, date, and either the full post or a meaningful opening paragraph. Not cards. Not a grid. Not truncated teasers with "Read More" buttons.
- **Near-invisible navigation.** The site nav should be a small set of plain text links at the top of the page (Home, Blog, Docs, Changelog — or whatever pages exist). No sticky header. No hamburger menu. No mega-menu. Just a quiet line of links.
- **Dates and metadata are whispers.** Dates appear in a small, muted style — never bold, never large. No author avatars. No category tags. No "5 min read" labels.
- **Generous whitespace between sections.** The space between blog posts on an index page, between sections on the landing page — this space does the work that dividers and boxes do on other sites. Let the whitespace create the structure.

### Landing Page

The landing page should convey what FeedMyOwl is and why it exists in as few words as possible. Think of it as a single, well-written essay — not a marketing page with feature grids and testimonial carousels.

- A clear, short headline (not a tagline pun — a plain statement of what this is)
- A paragraph or two explaining the philosophy (calm reading, no unread counts, no anxiety)
- A single call to action: a plain text link to sign up or try it. Not a giant colored button. A link — the same way seths.blog's "subscribe" call to action is just a line of text.
- If there are feature descriptions, they are prose paragraphs under simple headings — not icon grids or three-column feature cards

### Blog / Changelog

- Posts displayed newest-first in a vertical stream
- Each post: title (as a link), date (small, muted), and the full post body or a substantial opening excerpt
- No sidebar. No "related posts." No tags. No category filters.
- Individual post pages: title, date, body, and nothing else. No share buttons. No "next/previous" navigation cluttering the reading experience (a quiet link at the bottom is fine).

### Docs

- Same narrow-measure, typographic approach
- Navigation for docs can use a sidebar (left-aligned list of page links) since docs are reference material and need wayfinding. But the sidebar should be plain text links — not a tree with icons.
- The doc content area follows the same typographic rules as everything else: 38em measure, generous line-height, comfortable body text size.

---

## 4. Search Behavior (Webapp)

- The search input in the toolbar filters the **currently visible article list** (whichever feed or folder is selected in the sidebar).
- Filtering is client-side, matching against article title and snippet text.
- Search is instant (filter on keystroke, debounced ~150ms).
- When the search field is non-empty, only matching articles are shown in the article list.
- Pressing `Escape` clears the search and restores the full list.
- No full-text search of article bodies in the MVP. Just title + snippet matching.
- No separate search results page or view — filtering happens in place within Pane 2.

---

## 5. Visual Design System

### Philosophy

Typography-first, content-first, warm and quiet. The interface should feel like it was designed by someone who reads Tufte and writes a daily blog. Every element must earn its pixel. When in doubt, remove rather than add. The text is the interface — everything else is structure that supports the act of reading.

### Color Palette (define as CSS custom properties in `:root`)

Near-monochrome. Dark text on a light ground, with one quiet accent color. The warmth comes from the typography and spacing, not from color.

```css
:root {
  /* Light mode */
  --bg-primary: #ffffff;
  --bg-secondary: #f5f5f3;       /* sidebar, toolbar, code blocks */
  --bg-tertiary: #eaeaea;        /* hover states */
  --bg-selected: #e8f0fe;        /* selected article row */
  --text-primary: #1a1a1a;       /* body text, headings */
  --text-secondary: #555555;     /* read articles, secondary info */
  --text-muted: #767676;         /* timestamps, dates, metadata (WCAG AA for small text) */
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

Accessibility note: muted text is used at small sizes (`--text-xs`, `--text-sm`), so it must maintain at least 4.5:1 contrast in light mode.

These are the **only** colors in the application and website. Do not introduce others.

### Typography

```css
:root {
  /* Font stacks */
  --font-serif: Charter, "Bitstream Charter", "Sitka Text", Cambria,
                serif;
  --font-sans: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto,
               "Helvetica Neue", Arial, sans-serif;
  --font-mono: "SF Mono", "Fira Code", Consolas, "Liberation Mono",
               Menlo, monospace;

  /* Type scale */
  --text-xs: 0.75rem;      /* 12px — timestamps, dates, metadata */
  --text-sm: 0.8125rem;    /* 13px — snippets, secondary info */
  --text-base: 0.9375rem;  /* 15px — sidebar items, article list titles, nav */
  --text-lg: 1.125rem;     /* 18px — article reader body, website body */
  --text-xl: 1.5rem;       /* 24px — article title in reader pane */
  --text-2xl: 2rem;        /* 32px — website page titles, landing page heading */

  /* Line heights */
  --leading-tight: 1.3;
  --leading-normal: 1.5;
  --leading-relaxed: 1.65;  /* article reader body, website body */

  /* Weights — ONLY these two, never any others */
  --weight-normal: 400;
  --weight-semibold: 600;
}
```

**Font usage by context:**

- **Webapp chrome** (sidebar, article list, toolbar, folder headers): `var(--font-sans)` at `var(--text-base)` or smaller. The app chrome is functional and dense — a sans-serif system stack is correct here.
- **Article reader body** (Pane 3): `var(--font-serif)` at `var(--text-lg)` with `var(--leading-relaxed)`. This is where the user spends their time reading. A good serif at a comfortable size with generous line-height makes long-form reading pleasant. seths.blog demonstrates that comfortable reading type transforms the entire experience.
- **Article titles** in the reader: `var(--font-sans)` at `var(--text-xl)`. Sans-serif headings paired with serif body is a classic, readable combination.
- **Website body text**: `var(--font-serif)` at `var(--text-lg)` with `var(--leading-relaxed)`. The website is a reading experience — treat it the same as the article reader.
- **Website headings**: `var(--font-sans)` at appropriate scale sizes.
- **Code blocks** (everywhere): `var(--font-mono)`.

**Typography rules:**

- System font stacks only. No Google Fonts. No web font loading. Charter is available on macOS and iOS natively; the fallback chain ensures every platform gets a good serif.
- **Only two font weights: 400 and 600.** Never use `font-weight: bold`, `700`, or `300`.
- Folder/section headers in the webapp sidebar: `var(--text-xs)`, `uppercase`, `letter-spacing: 0.05em`, `color: var(--text-muted)`
- Timestamps and dates: `font-variant-numeric: tabular-nums`
- Use real typographic details: proper em-dashes (—), curly quotes (" " ' '), and adequate paragraph spacing. These small details signal that the designer cares about reading.

### Spacing

- Base unit: **4px**. All spacing values must be multiples of 4.
- Webapp sidebar item padding: `6px 12px`
- Webapp article list row padding: `10px 12px`
- Webapp article reader content padding: `32px 40px` (generous — the text should never feel crowded)
- Gap between sidebar sections: `16px`
- Website section spacing: `48px` to `64px` between major sections. Let whitespace do the structural work.
- Website paragraph spacing: `1em` margin-bottom minimum
- No spacing value larger than `64px` anywhere in the UI

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
- **No filled/primary buttons with colored backgrounds.** Ever. Not on the webapp, not on the website. The call-to-action on the landing page is a text link, not a big colored button.
- Input fields: `1px solid var(--border)`, `padding: 6px 10px`, `border-radius: 2px`, transparent background
- The Refresh button does not need to look "important" — it is just another control in the toolbar.

---

## 6. Keyboard Shortcuts (Webapp)

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

## 7. React / Next.js Implementation Notes (Webapp)

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

## 8. Constraints — DO NOT DO THESE

This section is critical. These are the patterns that will destroy the design and violate the project's principles. They apply to **both** the webapp and the website unless stated otherwise.

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
- ❌ No hero images, decorative illustrations, or stock photography.
- ❌ No card grids, masonry layouts, or multi-column content layouts for prose.
- ❌ No colored section backgrounds (alternating white/gray/blue sections).

### Interaction / UX

- ❌ No unread counts, badges, or numbers next to feeds. The project explicitly forbids these.
- ❌ No "Smart Feeds" (Today, All Unread, Starred). These are attention-anxiety patterns.
- ❌ No starred/bookmarked articles. FeedMyOwl is not a read-later service.
- ❌ No modals or dialogs. Use inline forms or dropdown panels.
- ❌ No toast notifications. Show status inline where the action happened.
- ❌ No skeleton loading screens or shimmer effects. Plain text "Loading..." is correct.
- ❌ No empty state illustrations. One line of muted text is correct.
- ❌ No onboarding, tutorials, welcome screens, or coach marks.
- ❌ No hamburger menu. Sidebar is always available on desktop in the webapp; the website uses a simple text nav.
- ❌ No "Read More" truncation buttons on the website blog index. Show the full post or a meaningful excerpt.
- ❌ No share buttons, reaction counts, or comment sections.
- ❌ No "estimated read time" labels.
- ❌ No author avatars or profile images.
- ❌ No tag pills or colored category badges.
- ❌ No sticky headers on the website.

### Technical

- ❌ **Do not install new npm dependencies** without explicit approval from the founder. Everything in this spec is achievable with what's already available plus DOMPurify.
- ❌ Do not create new API routes without explicit approval. Use the existing route structure in the project.
- ❌ Do not modify `lib/auth.ts`, `lib/payments.ts`, `lib/database.ts`, `lib/email.ts`, `lib/feed-parser.ts`, or `lib/error-tracking.ts` module boundaries — these are the service abstraction layers.

---

## 9. Quality Checklist

Before committing any UI code — for the webapp or the website — ask:

1. **"Does this help the user read better, or does it distract them?"** This is the only question that matters. If the answer is "distract," remove it.
2. **"If I removed this element entirely, would anything break?"** If no, remove it. The best interface element is one that does not exist.
3. **"Is the text comfortable to read for twenty minutes straight?"** Open the article reader or a website page, sit back, and read. If your eyes strain, the type is too small, the line-height too tight, or the measure too wide. Fix it.
4. **"Am I introducing visual chrome that isn't text?"** Boxes, shadows, icons, colored backgrounds, decorative dividers — each one must justify its existence. The default answer is no.
5. **"Is every function and file commented so the founder can understand it weeks later?"**
6. **"Am I introducing a new dependency? If so, stop and ask."**

---

## 10. The Test

After implementing any UI change, apply this test:

> "Does this feel like a calm, typographically confident reading environment — something designed by a person who writes one thoughtful essay a day and cares deeply about the experience of reading it?"

If the answer is no, revert it.

The finished product should feel like a quiet, native-quality tool — fast, focused, warm, and literate. Not a SaaS product. Not a startup landing page. **A reading tool that respects your attention.**
