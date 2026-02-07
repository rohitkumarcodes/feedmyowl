# FEEDMYOWL — UX Companion

> **This document extends `DESIGN.md`.** It governs user experience decisions, interaction patterns, responsive behavior, accessibility, and edge-case handling across the FeedMyOwl webapp and website. Where `DESIGN.md` defines how things look, this document defines how things behave and why. If anything here conflicts with `DESIGN.md`, `DESIGN.md` wins for visual specification; this document wins for behavioral specification. Both are subordinate to `FEEDMYOWL_PROJECT_CONTEXT.md`.

---

## Why This Document Exists

AI coding tools (Claude Code, Codex, and similar) are used extensively in this project. These tools are good at generating code but tend to default toward conventional SaaS patterns: modals, toast notifications, loading spinners, feature-rich dashboards, unread badges, and engagement-driven UX. Every one of those defaults is wrong for this project.

This document exists to give AI tools a clear mental model of how FeedMyOwl should behave — not just what it should look like — so they can make correct decisions when `DESIGN.md` doesn't cover a specific interaction.

---

## The Core Philosophy

FeedMyOwl exists because the modern web is an attention economy, and most tools designed to "help you read" are actually designed to keep you checking, scrolling, and engaging. FeedMyOwl rejects that model entirely.

The app has one job: helping readers read their feeds without distraction.

This means everything in the app falls into exactly one of three categories:

1. **The reading experience.** This is the product. Article text, typography, layout, navigation between articles — anything that directly serves the act of reading prose. This gets maximum care, attention, and space.

2. **Necessary burdens.** Things the app must support to function — sign-up, sign-in, settings, import/export, account management — but which are not the product. These should be minimal, fast, and forgettable. The user should spend as little time as possible on these tasks and never be reminded of them while reading.

3. **Distractions.** Everything else. Unread counts, push notifications, social features, AI summaries, recommendations, gamification, "smart" feeds, engagement metrics, sharing buttons. These do not exist. They will never exist. Any AI tool or contributor that introduces them is working against the project's purpose.

When you encounter a decision this document does not cover, apply this test:

> "Does this help the user read better, or does it pull their attention away from reading?"

If it pulls attention away, do not build it. If you are unsure, do not build it. The safest default is always to do less.

---

## Design Principles

These principles are ordered. When two principles conflict, the higher-ranked principle wins.

### 1. Protect the reader's attention

The reader opened this app to read. Every pixel, every interaction, every state change must serve that intent. Nothing in the interface should create anxiety, urgency, or compulsion. No numbers counting up. No badges demanding to be cleared. No notifications pulling the reader out of an article. The app should feel like opening a book, not opening an inbox.

This is not a soft preference. It is the foundational constraint of the entire project. Features that are useful in other contexts — unread counts, push notifications, starred articles, trending feeds — are actively harmful here because they transform a reading environment into a productivity dashboard.

### 2. Remove before you add

The best interface element is the one that does not exist. Before adding any UI element, ask whether the interface would break without it. If the answer is no, do not add it. If the answer is "it would be slightly less convenient," still do not add it. Only add elements that are necessary for the reader to accomplish what they came to do.

This applies to text as well. Labels, tooltips, helper text, confirmation messages — each one competes for the reader's attention. Use the fewest words possible. If a single muted line of text can replace a paragraph of explanation, use the single line.

### 3. Inline over overlay

No modals. No dialogs. No toast notifications. No popups. No dropdown menus that obscure content. Every interaction happens inline, in context, where the user initiated it. Forms expand in place. Status messages appear where the action happened. Errors display next to the element that caused them.

Overlays break reading flow. They demand immediate attention. They create a "mode" the user must exit before returning to what they were doing. All of these properties are antithetical to a calm reading environment.

### 4. Text is the interface

The app's visual language is typographic, not graphic. Information is conveyed through font weight, size, color, and spacing — not through icons, badges, colored backgrounds, or decorative elements. A semibold title means "unread." A muted color means "secondary." An uppercase, letter-spaced label means "section header." That is the entire visual vocabulary.

When you need to convey state or hierarchy, reach for a typographic tool first. Reach for a visual element only if typography alone genuinely cannot do the job.

### 5. Quiet failure, clear recovery

When something goes wrong — a feed fails to fetch, an article can't be extracted, a network request times out — the app should not shout about it. No red banners. No exclamation icons. No alert dialogs. Errors are displayed as calm, muted, inline text that explains what happened and, when possible, what the user can do about it. The tone is informative, not alarming.

The reader should never feel that the app is broken or panicking. Things fail on the internet. The app acknowledges this calmly and moves on.

---

## Content Rendering

### Full-Article Extraction

FeedMyOwl fetches and renders the full content of articles in the reader pane. The reader should get the complete reading experience inside the app, because we do not control how the original website displays the article — it may be cluttered with ads, popovers, newsletter signup forms, and other distractions that defeat the purpose of using a feed reader.

**When full extraction succeeds:** Render the sanitized article HTML in the reader pane using the app's own typographic styles. The article should look like it belongs in FeedMyOwl, not like an embedded webpage.

**When full extraction fails:** Fall back to the feed's provided summary content (which may be a partial excerpt or a description), and display the "Open original ↗" link more prominently so the reader can access the full article on the source website. Do not show an error message for this — the fallback is the experience. The reader may not even know the difference between a full extraction and a long feed summary, and that is fine.

### Handling Media in Articles

Some feeds contain audio (podcasts) or video (YouTube channels, video blogs). These should be rendered inline:

- **Audio enclosures:** Render as a native HTML `<audio>` element with controls. No custom player UI. The browser's native audio controls are familiar, accessible, and zero-maintenance.
- **Video embeds:** Render as a native HTML `<video>` element or an `<iframe>` for external embeds (YouTube, Vimeo). Constrain to `max-width: 100%` within the article content area. No autoplay. No custom play button overlays.
- **Images:** Render inline at `max-width: 100%`. No borders, no shadows, no lightbox behavior.

The principle: use the browser's native rendering for media. Do not build custom media players or viewers. They are maintenance burdens that do not improve the reading experience.

### Broken Images

Article extraction will sometimes pull in broken image URLs (dead links, hotlink-protected images, tracking pixels). When an image fails to load:

- Replace it with a minimal placeholder: a light gray rectangle (`var(--bg-secondary)`) at a reasonable aspect ratio (16:9 default), containing a single line of muted centered text: "Image could not be loaded."
- The placeholder should not be visually loud. It should be ignorable — the reader is here for the text.
- Do not retry loading. Do not show a reload button on the placeholder. If the image is important, the reader can use the "Open original ↗" link to see it on the source site.

### Sanitization

All article HTML must be sanitized with DOMPurify before rendering. Strip scripts, event handlers, iframes to untrusted sources, and any embedded styles that would override the app's typography (inline `font-family`, `font-size`, `line-height`, `color` declarations). The goal is to preserve the article's semantic structure (headings, paragraphs, lists, blockquotes, code blocks, links, images) while ensuring it renders in the app's own visual language.

---

## Feed Organization

### Folders

Feeds are organized into folders. This is the only organizational unit — no tags, no labels, no smart groups.

- Every feed belongs to exactly one folder.
- New feeds go to the **Uncategorized** folder by default.
- The user can create folders and move feeds between them.
- Folders appear in the sidebar, each expandable/collapsible.
- The Uncategorized folder always exists and cannot be deleted or renamed. It appears at the bottom of the sidebar, below all user-created folders.
- Deleting a folder moves its feeds to Uncategorized — it does not delete the feeds.
- Folder order in the sidebar: alphabetical by name, with Uncategorized pinned at the bottom.
- Feed order within a folder: alphabetical by name.

### What selecting a folder does

When the user clicks a folder header in the sidebar, the article list (Pane 2) displays articles from all feeds in that folder, sorted newest-first. This is the only "aggregate view" in the app — there is no "All Feeds" view. If the user wants to see everything, they must select feeds or folders individually.

The reason for no "All Feeds" aggregate: it recreates the infinite-scroll, everything-at-once experience that feeds are supposed to rescue the reader from. A folder is a deliberate, bounded scope. "All Feeds" is an unbounded scope.

---

## Necessary Burdens

These are the non-reading tasks the app must support. Each one should be as minimal, fast, and unintrusive as possible.

### Sign-Up and Sign-In

Handled by Clerk. The app's responsibility is to get the user through authentication and into the reading experience as quickly as possible. No welcome screens. No onboarding tutorials. No "set up your profile" step. After authentication, the user lands directly in the three-pane reading interface.

### Adding a Feed

An inline form — not a modal — with a single text input for the URL and a submit button. The form appears in place (at the bottom of the sidebar or below the toolbar) and disappears after submission.

- If the URL is valid and the feed is fetchable: add the feed to Uncategorized, fetch its articles, and select it in the sidebar.
- If the URL is invalid or the feed cannot be fetched: show an inline error message below the input, in muted text, explaining what went wrong. Examples: "This URL doesn't appear to be a valid RSS or Atom feed." or "Could not reach this URL. Check the address and try again."
- Do not clear the input on error — the user may want to correct a typo.
- Clear the input and collapse the form on success.

### OPML Import

OPML import allows users to bring feeds from another reader. This is a bulk operation that may involve many feeds.

- Trigger: a file upload input or drag-and-drop target in the settings area. Not in the sidebar — import is a setup task, not a reading task.
- **Progress feedback:** When importing, show inline text that updates as feeds are processed: "Importing feeds… 12 of 47 complete." This appears in place where the import was initiated. Not a modal. Not a toast. Not a progress bar — just updating text.
- **Errors in the file:** If some URLs in the OPML are invalid or unreachable, skip them silently and continue. After import completes, show a summary: "Imported 41 feeds. 6 could not be reached and were skipped." The user does not need to see which 6 failed or why. If they notice a feed is missing, they can add it manually.
- **Duplicates:** If a feed URL already exists in the user's subscriptions, skip it. Do not create duplicates. Do not warn about duplicates.
- Imported feeds respect the folder structure in the OPML file. If the OPML defines categories/groups, create corresponding folders. Feeds without a category go to Uncategorized.

### OPML Export

Let the user download their subscriptions as an OPML file. This is a single action — a link or button in settings that triggers a file download. No configuration. No preview. The exported file includes all feeds and their folder assignments.

### Account Data Export

The user should be able to export all their data — feed subscriptions, folder structure, and article read/unread state — in a portable format (JSON or OPML+JSON). This is a single action in settings. No configuration. Download triggers immediately.

### Account Deletion

The user should be able to permanently delete their account and all associated data. This is a destructive action and one of the few places where a confirmation is appropriate.

- Location: settings page, at the bottom (conventional placement for danger zones).
- Interaction: the user clicks "Delete my account." Inline confirmation text appears: "This will permanently delete your account and all your data. This cannot be undone." with a confirm action (a text link reading "Yes, delete my account") and a cancel action.
- No modal. The confirmation is inline.
- On confirmation: delete all user data and sign the user out. Redirect to the landing page.

### Settings

Settings should be a single, simple page (or an inline panel in the sidebar) with the minimum number of options. Currently, these are the only settings that should exist:

- **Import feeds** (OPML file upload)
- **Export feeds** (OPML download)
- **Export all data** (full data download)
- **Delete account** (with inline confirmation)

If additional settings become necessary in the future, the principle is: every setting is an admission that the app failed to make the right decision automatically. Minimize the number of decisions the user must make.

---

## Error Handling

Errors are a fact of life on the web. Feeds go offline, servers return errors, network connections drop. FeedMyOwl handles all of this calmly.

### Feed Fetch Errors

When a feed fails to refresh (404, timeout, malformed XML, DNS failure, or any other error):

- **In the sidebar:** The feed name remains visible. It is not removed, hidden, or marked with an error icon. The user should not be alarmed.
- **In the article list:** If the user selects the errored feed, the article list shows the most recently cached articles (which may be from the last successful fetch). At the top of the list, display a single line of muted text explaining the issue. The message should be informative, calm, and specific enough to be useful. Examples:
  - "This feed could not be reached. The server returned a 404 error, which usually means the feed URL has changed or the feed no longer exists. The articles below are from the last successful update."
  - "This feed could not be updated. The server did not respond within 15 seconds. This is usually temporary — try refreshing again later. The articles below are from the last successful update."
  - "This feed returned content that is not valid RSS or Atom XML. The feed may have been moved or replaced. The articles below are from the last successful update."
- **Tone:** Informative, not alarming. The message explains what happened and gently suggests what the user can do (or that it might resolve itself). No exclamation marks. No red text. No error icons.
- **No retry loops.** Do not automatically retry failed feeds. The user can press Refresh again when they choose to.

### Network Errors (Global)

If the app cannot reach the server at all (user is offline, server is down):

- **During Refresh:** The Refresh button text changes from "Refreshing…" back to "Refresh" and a single line of muted text appears near the toolbar: "Could not connect to the server. Your previously loaded articles are still available below."
- **On initial load:** If the app cannot reach the server when first opened, display a centered line of muted text in the main content area: "Could not connect to the server. Check your internet connection and try again."
- **No retry banners.** No "Reconnecting in 5s…" countdown. The user can manually refresh when they are ready.

### Article Extraction Errors

Covered in the Content Rendering section above. Fallback to feed summary + "Open original ↗" link. No error message shown to the user — the fallback is the experience.

---

## Empty States

Every empty state in the app is a single line of muted text. No illustrations. No decorative graphics. No multi-step setup wizards. One line.

### First-Run Empty State (No Feeds Yet)

When a new user signs in for the first time, they have no feeds. The three-pane layout is visible but all panes are essentially empty. This is the one place where a small amount of guidance is appropriate — but it must be minimal:

- **Sidebar (Pane 1):** The Uncategorized folder exists but is empty. Below it, the "+" affordance is visible.
- **Article list (Pane 2):** A single centered line of muted text: "Add a feed to get started." — or, if you want to be slightly more helpful: "Paste a feed URL using the + button to subscribe to your first feed."
- **Reader pane (Pane 3):** "Select an article to read." (This is the standard empty state for this pane, regardless of first-run status.)

That is the entire onboarding experience. No tutorial. No walkthrough. No coach marks pointing at UI elements. The interface is simple enough to be self-explanatory. If it is not, that is a design failure to fix, not an onboarding problem to paper over.

### Other Empty States

- **Feed selected but has no articles:** "No articles in this feed."
- **Folder selected but has no feeds:** "No feeds in this folder."
- **Search returns no results:** "No articles match your search."
- **Reader pane with no article selected:** "Select an article to read."

---

## Article Retention

Articles are retained for **90 days** from the date they were fetched. After 90 days, they are quietly purged from the database. There is no setting for this. There is no warning before deletion. There is no archive feature.

This is a deliberate constraint: FeedMyOwl is a reading tool, not an archival tool. If the reader wants to keep an article permanently, they should save it in a dedicated tool (Pocket, Instapaper, a note-taking app, their browser bookmarks). FeedMyOwl's job is to present recent content for reading, not to store content forever.

The 90-day window should never be surfaced in the UI. The reader should not see "this article will be deleted in 12 days" or anything similar. Articles simply exist when they are recent and cease to exist when they are not.

---

## Offline Behavior

FeedMyOwl should be usable without an internet connection, within limits. The principle: a reading tool that breaks when you are on a plane, a train, or a patchy connection is not respecting your attention — it is wasting it.

**What works offline:**

- Reading any article that was previously fetched and is still within the 90-day retention window. Article content is cached locally (in the browser's storage — IndexedDB or similar) so it is available without a network request.
- Navigating between feeds and articles in the sidebar and article list.
- Searching/filtering the article list (this is client-side anyway).

**What does not work offline:**

- Refreshing feeds (requires server communication).
- Adding new feeds (requires server communication).
- Any settings changes that require server persistence.

**How to communicate offline state:**

- Do not show a persistent "You are offline" banner. That is a distraction.
- If the user attempts an action that requires the network (Refresh, Add Feed), show inline muted text near the action: "You appear to be offline. This action requires an internet connection."
- When the connection returns, do not show a "You're back online!" notification. Just allow actions to work again. The reader does not need to be narrated to.

---

## Responsive Behavior (Mobile and Tablet)

`DESIGN.md` defines the desktop three-pane layout. This section defines how that layout adapts to smaller screens.

### The Principle

On mobile, the three panes become three *views* — the user sees one at a time and navigates between them. The mental model shifts from "three columns side by side" to "a stack of screens I move through." But the visual language, typography, and all design principles remain identical. A mobile user should feel like they are using the same app, just in a narrower window.

### Breakpoints

Use only two breakpoints. More breakpoints create more edge cases and more maintenance burden for minimal benefit.

- **Desktop:** viewport width ≥ 768px. Three-pane side-by-side layout as defined in `DESIGN.md`.
- **Mobile:** viewport width < 768px. Single-pane stacked layout described below.

There is no separate "tablet" breakpoint. Tablets in landscape orientation will use the desktop layout. Tablets in portrait orientation will use the mobile layout. This is fine. The three-pane layout works well down to about 768px; below that, it does not.

### Mobile Layout: Single-Pane Navigation

On mobile, the three panes are replaced by three full-screen views arranged in a navigation stack:

**View 1 — Feed List (replaces Sidebar)**

- Full-screen vertical list of folders and feeds.
- Folder headers are tappable to expand/collapse.
- Tapping a feed or folder navigates to View 2 (Article List).
- The "Add Feed" affordance ("+") appears at the top or bottom of this view.
- Refresh and Settings are accessible from this view (top bar or top-right text link).
- This view has a top bar with the app name ("FEEDMYOWL") and action links (Refresh, Settings, "+").

**View 2 — Article List (replaces Pane 2)**

- Full-screen vertical list of articles for the selected feed or folder.
- A back affordance at the top-left: "← Feeds" (plain text, not an icon button). Tapping it returns to View 1.
- The feed or folder name appears in the top bar.
- Tapping an article navigates to View 3 (Article Reader).
- Search input is available in this view, either always visible or shown via "/" keyboard shortcut / a "Search" text link.

**View 3 — Article Reader (replaces Pane 3)**

- Full-screen article reading view.
- A back affordance at the top-left: "← Articles" (plain text). Tapping it returns to View 2.
- The article title, metadata, and body are laid out exactly as defined in `DESIGN.md` for the reader pane, with adjusted padding for mobile (less horizontal padding, but still generous — the text must not feel crammed against the screen edges).
- "Open original ↗" link at the bottom, same as desktop.
- The content is still constrained to a comfortable reading measure. On small screens, the screen width itself is the constraint, so `max-width: 38em` may not apply — but side padding should be at least `16px` on each side.

### Navigation Between Views

- **No animations.** Views change instantly. No slide transitions, no fade effects. The reader tapped something; the next view appears. This is a reading tool, not a showcase for CSS transitions.
- **Back navigation:** The browser's back button and swipe-to-go-back gesture should work. Each view change pushes a history entry (using the browser's History API or Next.js routing) so the user can navigate backward naturally.
- **No bottom tab bar.** The app does not have multiple top-level sections. It is a linear navigation: feeds → articles → read. A tab bar implies multiple parallel sections and adds permanent visual chrome that competes with the reading experience.
- **No hamburger menu.** The feed list IS the primary navigation. It is always the starting view. There is nothing to hide behind a hamburger.

### Touch Targets

- Minimum touch target size: 44×44px (Apple's Human Interface Guidelines recommendation). This applies to feed items in the sidebar, article rows in the list, and all interactive controls.
- Feed rows and article rows should have generous padding (at least `12px 16px`) to ensure comfortable tapping.
- The "+" and back affordances should be large enough to tap without precision.

### What Does Not Change on Mobile

- The typography. Serif body text, sans-serif chrome, same font sizes (the mobile screen is held closer to the eyes, so the same sizes remain comfortable).
- The interaction philosophy. No unread counts. No badges. No push notifications. No modals.
- The color palette. Identical.
- The error handling. Identical — inline, muted, calm.
- The empty states. Identical — one line of muted text.

---

## Accessibility

FeedMyOwl is a reading tool. Accessibility is not a compliance checkbox — it is philosophically aligned with the project's core purpose: respecting the reader. A reading tool that excludes readers who use screen readers, keyboard navigation, or assistive technologies is failing at its fundamental job.

### Semantic HTML

Use semantic HTML elements everywhere. This is the single highest-leverage accessibility practice and it costs nothing.

- The three panes are `<nav>` (sidebar), `<section>` or `<main>` (article list), and `<article>` (reader pane).
- Feed lists and article lists use `<ul>` and `<li>`, not `<div>` stacks.
- Article content preserves its semantic structure: `<h1>` through `<h6>`, `<p>`, `<blockquote>`, `<pre>`, `<code>`, `<ul>`, `<ol>`, `<figure>`, `<figcaption>`.
- Buttons are `<button>`. Links are `<a>`. Inputs are `<input>` inside `<label>` or with `aria-label`.
- The "+" add-feed affordance is a `<button>` with `aria-label="Add feed"`, not a styled `<span>`.

### ARIA Landmarks and Labels

- The sidebar: `role="navigation"` with `aria-label="Feed list"`.
- The article list: `role="region"` with `aria-label="Article list"`.
- The reader pane: `role="main"` with `aria-label="Article reader"`.
- Folder expand/collapse: `aria-expanded="true|false"` on the folder header button.
- Selected feed: `aria-current="true"` on the active feed item.
- Selected article: `aria-current="true"` on the active article row.

### Keyboard Navigation

`DESIGN.md` defines keyboard shortcuts (`j`/`k`, `Enter`, `r`, `/`, `Escape`, `Cmd+Shift+S`). These must work in addition to standard keyboard navigation:

- `Tab` moves focus through interactive elements in a logical order: sidebar → article list → reader pane → toolbar controls.
- `Arrow keys` navigate within lists (feed list, article list) when that list has focus.
- `Enter` activates the focused element.
- `Escape` clears search or returns focus from a form field.
- All keyboard shortcuts are disabled when an `<input>` or `<textarea>` is focused (except `Escape`), to avoid conflicts with typing.
- Focus is visible. Use `outline: 2px solid var(--accent); outline-offset: 2px` as defined in `DESIGN.md`. Never remove focus outlines.

### Focus Management

When the user performs an action that changes the visible content, move focus to the appropriate element:

- Selecting a feed: move focus to the article list.
- Selecting an article: move focus to the reader pane (specifically, the article title `<h1>`).
- Closing or collapsing a panel: move focus to the nearest logical element that is still visible.
- Submitting the "Add Feed" form: on success, move focus to the new feed in the sidebar. On error, move focus to the error message.
- On mobile, navigating between views: move focus to the heading or first interactive element of the new view.

### Screen Reader Announcements

Use `aria-live` regions for dynamic content updates:

- When the article list updates after selecting a feed: announce the number of articles (e.g., `aria-live="polite"` region with "24 articles" or "No articles in this feed").
- When a feed is refreshed: announce completion (e.g., "Feeds refreshed").
- Error messages: use `role="alert"` so they are announced immediately without interrupting the current reading flow aggressively — `aria-live="polite"` is preferred over `"assertive"` unless the error blocks the user from proceeding.

### Reduced Motion

Respect `prefers-reduced-motion`:

```css
@media (prefers-reduced-motion: reduce) {
  * {
    transition: none !important;
  }
}
```

The app already uses minimal transitions (≤100ms as per `DESIGN.md`), but users who have explicitly requested reduced motion should see no transitions at all.

### Color and Contrast

- All text must meet WCAG 2.1 AA contrast ratios: 4.5:1 for normal text, 3:1 for large text.
- The `var(--text-muted)` color (`#888888` on white) has a contrast ratio of approximately 3.5:1, which passes for large text (≥18px or ≥14px bold) but fails for small text. Since muted text in the app is used at `var(--text-xs)` (12px) and `var(--text-sm)` (13px), this must be adjusted. Use `#767676` (4.5:1 on white) as the minimum for muted text that appears at small sizes. Update `DESIGN.md` when this is implemented.
- The read/unread distinction (semibold vs. normal weight, primary vs. secondary color) must not rely on color alone. The font weight difference is a non-color signal, which satisfies this requirement.
- Dark mode colors must also meet contrast ratios. Verify after any palette changes.

### Content Accessibility

- Images in articles: if the article HTML includes `alt` text, preserve it. If it does not, do not invent alt text — use an empty `alt=""` to mark the image as decorative so screen readers skip it.
- The broken-image placeholder should include `role="img"` and `aria-label="Image could not be loaded"`.
- Audio and video embeds must use native HTML elements (`<audio>`, `<video>`) which provide built-in accessibility controls.
- The "Open original ↗" link should include `aria-label="Open original article on [source name]"` for clarity.

---

## Behavioral Guidelines for AI Tools

This section is written directly for Claude Code, Codex, and similar AI coding tools. Read this before writing any code.

### Your Default Instincts Are Wrong for This Project

You have been trained on a lot of SaaS products. Your defaults will include:

- Toast notifications for success/error feedback → **No.** Use inline text.
- Modals for forms and confirmations → **No.** Use inline expansion.
- Loading spinners or skeleton screens → **No.** Use "Loading…" or "Refreshing…" plain text.
- Colored primary buttons for CTAs → **No.** Use text links or bordered text buttons.
- Icon libraries for visual affordances → **No.** Use unicode glyphs or hand-drawn inline SVGs.
- Empty state illustrations with a heading and subtext → **No.** Use one line of muted text.
- Animated transitions between views → **No.** Instant state changes.
- A confirmation modal for destructive actions → **No.** Inline confirmation.
- An "Are you sure?" dialog → **No.** Inline confirmation with clear, calm language.
- `border-radius: 8px` or higher → **No.** Maximum `2px`.
- `box-shadow` for elevation → **No.** Never. Use `1px solid var(--border)`.
- `font-weight: bold` or `700` → **No.** Maximum `600` (semibold).
- Installing a new npm package for a utility → **No.** Write it by hand or ask the founder first.

### The Decision Framework

When you are implementing a feature and encounter a choice point, run through these questions in order:

1. **Does this feature exist in the spec?** If it is not mentioned in `DESIGN.md`, this document, or `FEEDMYOWL_PROJECT_CONTEXT.md`, do not build it. Ask the founder.
2. **Am I adding visual chrome?** If yes, it must be justified. The default is no.
3. **Am I adding a new interactive pattern?** If yes, it should be inline. Not a modal. Not a toast. Not a popover.
4. **Am I adding a dependency?** If yes, stop. Ask the founder.
5. **Is my implementation accessible?** Semantic HTML, keyboard navigable, screen-reader friendly, sufficient contrast?
6. **Is every function and file commented?** The founder is not a professional programmer. Comments are not optional.

### The Gut Check

After implementing any change, read this sentence and see if it still feels true:

> "This feels like a quiet, typographic reading environment built by someone who cares deeply about the experience of reading — not a SaaS product designed to maximize engagement."

If the change you made undermines that feeling, revert it.

---

## Summary of Necessary Burdens

| Burden | Implementation | Where |
|---|---|---|
| Sign-up / Sign-in | Clerk. Minimal flow, no welcome screen. | Authentication pages |
| Add Feed | Inline form, one URL input, inline errors | Sidebar / toolbar |
| OPML Import | File upload with inline progress text | Settings |
| OPML Export | Single-action file download | Settings |
| Data Export | Single-action download (JSON or OPML+JSON) | Settings |
| Account Deletion | Inline confirmation, then delete all data | Settings (bottom) |
| Settings Page | Minimal — only the items above | Accessible from sidebar or toolbar |

---

## Summary of Things That Do Not Exist

This list is as important as any feature specification. These items have been deliberately excluded. Do not build them. Do not suggest them. Do not add "just a small version" of them.

- Unread counts, badges, or numbers next to feeds or folders
- Push notifications or background polling
- Starred, bookmarked, or saved articles
- An "All Feeds" aggregate view
- Smart feeds (Today, Unread, Popular)
- Social features (sharing, comments, likes)
- Feed discovery or recommendations
- AI-generated summaries or tags
- Estimated read time
- Author avatars or profile images
- Onboarding tutorials, coach marks, or walkthroughs
- Gamification (streaks, achievements, reading goals)
- Analytics or reading statistics visible to the user
- Theme customization or font settings (the design is the design)
- A "mark all as read" button (there are no unread counts to clear)
- Infinite scroll (article lists are finite per feed/folder)
- A mobile bottom tab bar
- A hamburger menu
- Any notification or banner that is not directly caused by the user's own action
