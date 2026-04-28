import "server-only";

/**
 * Local-only fixture data for smoke tests and coding-agent UI verification.
 *
 * This avoids requiring a real Clerk session or database rows when an agent
 * only needs to inspect layout, dialogs, and navigation in `next dev`.
 */
import type {
  FeedItemViewModel,
  FeedViewModel,
  FolderViewModel,
} from "@/features/feeds/types/view-models";

const now = new Date("2026-02-12T10:00:00.000Z");

function daysAgo(days: number): string {
  const value = new Date(now);
  value.setUTCDate(value.getUTCDate() - days);
  return value.toISOString();
}

function hoursAgo(hours: number): string {
  const value = new Date(now);
  value.setUTCHours(value.getUTCHours() - hours);
  return value.toISOString();
}

function article(params: {
  id: string;
  title: string;
  content: string;
  author: string;
  daysAgo: number;
  hoursAgo?: number;
  read?: boolean;
  saved?: boolean;
}): FeedItemViewModel {
  const createdAt = params.hoursAgo != null ? hoursAgo(params.hoursAgo) : daysAgo(params.daysAgo);
  return {
    id: params.id,
    title: params.title,
    link: `https://example.com/${params.id}`,
    content: params.content,
    author: params.author,
    publishedAt: createdAt,
    readAt: params.read
      ? params.hoursAgo != null
        ? hoursAgo(Math.max(params.hoursAgo - 2, 0))
        : daysAgo(Math.max(params.daysAgo - 1, 0))
      : null,
    savedAt: params.saved
      ? params.hoursAgo != null
        ? hoursAgo(Math.max(params.hoursAgo - 2, 0))
        : daysAgo(Math.max(params.daysAgo - 1, 0))
      : null,
    createdAt,
  };
}

export function getDemoFolders(): FolderViewModel[] {
  return [
    {
      id: "demo-folder-product",
      name: "Product",
      createdAt: daysAgo(20),
      updatedAt: daysAgo(2),
    },
    {
      id: "demo-folder-engineering",
      name: "Engineering",
      createdAt: daysAgo(18),
      updatedAt: daysAgo(3),
    },
    {
      id: "demo-folder-design",
      name: "Design",
      createdAt: daysAgo(15),
      updatedAt: daysAgo(5),
    },
    {
      id: "demo-folder-business",
      name: "Business & Strategy",
      createdAt: daysAgo(12),
      updatedAt: daysAgo(1),
    },
  ];
}

export function getDemoFeeds(): FeedViewModel[] {
  return [
    {
      id: "demo-feed-release-notes",
      title: "Release Notes Weekly",
      customTitle: null,
      description: "Product updates for the FeedMyOwl demo workspace.",
      url: "https://example.com/release-notes.xml",
      folderIds: ["demo-folder-product"],
      lastFetchedAt: daysAgo(0),
      lastFetchStatus: "success",
      lastFetchErrorCode: null,
      lastFetchErrorMessage: null,
      lastFetchErrorAt: null,
      createdAt: daysAgo(20),
      items: [
        article({
          id: "demo-article-import",
          title: "Import preview now catches messy OPML before it writes",
          content:
            "<p>The import flow validates feeds first, then lets the reader decide when to apply the changes. This prevents broken subscriptions from polluting your workspace.</p><p>When you upload an OPML file, the system parses every subscription entry and checks each feed URL before writing anything. Feeds that fail validation — broken URLs, unparseable XML, or unsupported formats — are flagged in a review screen. You can choose to skip those or fix the source file and re-import.</p><p>This two-phase approach means your feed list never ends up in a half-imported state. The old behavior wrote feeds one by one and left your workspace cluttered with dead entries if anything went wrong halfway through. Now the entire operation is atomic from the reader's perspective: either the full set of valid feeds gets added, or nothing changes.</p>",
          author: "FeedMyOwl",
          daysAgo: 0,
          hoursAgo: 2,
          saved: true,
        }),
        article({
          id: "demo-article-shortcuts",
          title: "Keyboard shortcuts are easier to discover",
          content:
            "<p>The sidebar now gives readers a calmer way to find and use shortcut help. Press <kbd>?</kbd> anywhere to see the full list.</p><p>Previously, keyboard shortcuts were documented only in a settings panel that most readers never visited. New users who preferred keyboard navigation had to hunt through menus or search the web for help. The shortcut discovery problem was a known gap in the onboarding flow.</p><p>The new overlay is triggered by pressing <kbd>?</kbd> from any screen. It shows a categorized list of shortcuts: navigation (j/k to scroll, n/p to move between articles), actions (s to save, m to toggle read status), and全局 commands (g then f to focus the feed list). The overlay respects dark mode and dismisses on Escape or clicking outside.</p><p>We also added a small hint in the footer bar that reads \"Press ? for shortcuts\" so first-time visitors know the feature exists. Usage data shows the overlay is opened by about 40% of new readers within their first session.</p>",
          author: "FeedMyOwl",
          daysAgo: 2,
          read: true,
        }),
        article({
          id: "demo-article-dark-mode",
          title: "Dark mode arrives for late-night reading sessions",
          content:
            "<p>Your eyes will thank you. Dark mode respects your system preference and can be toggled from Settings.</p><p>The implementation follows the system <code>prefers-color-scheme</code> media query by default but adds a manual override in Settings for readers who want to switch independently of their OS. Once set, the preference is persisted in local storage and applied before the first paint to avoid a flash of light mode.</p><p>We took care to preserve contrast ratios across the full palette. Links, code blocks, and UI chrome all received dedicated dark values rather than simple inversion. The code block background, for instance, shifted to a cooler dark gray instead of pure black to reduce eye strain during long reading sessions.</p><p>One subtle touch: the reader view uses a slightly warmer background tint in dark mode (hsl(220, 20%, 8%)) that mimics the feel of reading on dark e-ink devices. Early testers reported noticeably less fatigue during sessions longer than an hour.</p>",
          author: "FeedMyOwl",
          daysAgo: 5,
          read: true,
        }),
        article({
          id: "demo-article-search",
          title: "Full-text search across all your feeds",
          content:
            "<p>Search now indexes article content, not just titles. Results update in real time as you type.</p><p>The search index is built incrementally as articles are fetched. Each feed's content is tokenized, lowercased, and stored in a trigram-based index that supports fuzzy matching and partial word completion. Misspellings within one character are automatically corrected.</p><p>Results are ranked by relevance: exact title matches rank highest, followed by content matches with higher term frequency. The most recent articles are preferred when relevance scores are tied. Filters can narrow results by feed, folder, read status, or date range.</p><p>Search performance is critical since a reader with 50 feeds and thousands of articles needs results in under 200ms. The current implementation uses a client-side index for instant feedback, with a server-side fallback for workspace-level search when the client index is unavailable.</p>",
          author: "FeedMyOwl",
          daysAgo: 8,
          read: true,
        }),
        article({
          id: "demo-article-folders",
          title: "Drag-and-drop folder organization",
          content:
            "<p>Reorder your sidebar and move feeds between folders with simple drag and drop. Changes sync automatically.</p><p>The sidebar uses the HTML5 Drag and Drop API with touch support for mobile readers. Each folder and feed item is a drag handle. Dragging a feed onto a folder assigns it to that folder; dragging it to the top-level area removes folder membership.</p><p>Folder reordering is persisted as a simple ordinal index. The sidebar renders folders in order, then feeds within each folder. Feeds without a folder appear under an \"Uncategorized\" section at the bottom. Drag-and-drop operations are optimistic — the UI updates immediately, and a small toast appears if the server sync fails.</p><p>Multi-feed selection is supported: hold Shift and click to select a range, then drag them all into a folder at once. This makes bulk organization after a large OPML import much faster.</p>",
          author: "FeedMyOwl",
          daysAgo: 12,
        }),
      ],
    },
    {
      id: "demo-feed-platform",
      title: "Platform Notes",
      customTitle: null,
      description: "Reliability, performance, and backend engineering notes.",
      url: "https://example.com/platform.xml",
      folderIds: ["demo-folder-engineering"],
      lastFetchedAt: daysAgo(0),
      lastFetchStatus: "success",
      lastFetchErrorCode: null,
      lastFetchErrorMessage: null,
      lastFetchErrorAt: null,
      createdAt: daysAgo(18),
      items: [
        article({
          id: "demo-article-boundaries",
          title: "Service boundaries keep agent changes reviewable",
          content:
            "<p>Database, auth, payments, email, feed parsing, and error tracking each stay behind one local module. No import ever crosses a boundary.</p><p>This architecture was driven by a simple constraint: a coding agent should be able to make changes to one service without understanding the implementation details of the others. Each boundary file exports a focused API surface — database operations through query helpers, auth through Clerk wrapper functions, email through a send function that accepts a template name and payload.</p><p>The boundary rule is enforced by a custom lint check (<code>pnpm check:architecture</code>) that scans import statements across the codebase. Any file outside <code>src/lib/server/</code> importing directly from an underlying SDK — say, <code>@clerk/nextjs/server</code> or <code>resend</code> — triggers a build failure. The only documented exceptions are client-side auth hooks and middleware boilerplate.</p><p>This has made code reviews significantly easier. Instead of auditing across the full stack, reviewers can focus on the boundary interface. The implementation behind the boundary is treated as a black box.</p>",
          author: "Engineering",
          daysAgo: 1,
        }),
        article({
          id: "demo-article-rate-limiting",
          title: "Rate limiting now uses Upstash Redis with fail-open",
          content:
            "<p>If Redis is unreachable, requests proceed without rate limiting rather than breaking the UI.</p><p>The rate limiter uses a sliding window algorithm stored in Upstash Redis. Each unique visitor (identified by IP or session ID) gets a counter that expires after the window duration. When the counter exceeds the threshold, subsequent requests receive a 429 response with a Retry-After header.</p><p>The fail-open behavior is implemented via a try-catch around the Redis call. If the Redis client throws (network error, timeout, auth failure), the rate limiter returns a pass decision and logs the incident to Sentry. This means a Redis outage does not cascade into a full site outage — readers can still use the app, they just lose rate limit protection until Redis recovers.</p><p>We chose Upstash specifically because its REST API uses HTTP rather than WebSocket connections, which simplifies deployment in serverless environments. The REST client also supports synchronous reads with low latency — typically under 5ms from Vercel regions.</p>",
          author: "Engineering",
          daysAgo: 3,
          read: true,
        }),
        article({
          id: "demo-article-ssrf",
          title: "SSRF protection hardened for feed fetching",
          content:
            "<p>Feed fetcher now blocks private IP ranges, validates redirects, and enforces a strict timeout at every layer.</p><p>Server-Side Request Forgery is a common attack vector in applications that fetch remote URLs on behalf of users. An attacker could craft a feed URL that points to an internal service (like a cloud metadata endpoint) and exfiltrate credentials. Our mitigation strategy has three layers.</p><p>First, the fetcher resolves the hostname and checks the resulting IP against a blocklist of private and reserved ranges (10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16, 127.0.0.0/8, ::1, and cloud metadata IPs like 169.254.169.254). If the IP matches any blocklisted range, the fetch is aborted immediately.</p><p>Second, redirects are re-validated. A feed might initially return a public IP but redirect to a private one. The fetcher follows up to 5 redirects, checking each resolved IP against the blocklist. Redirect chains that loop or exceed the limit are terminated.</p><p>Third, a total timeout of 15 seconds is enforced at the HTTP client level, with per-connection timeouts of 5 seconds. This prevents a slow or malicious server from holding connections open indefinitely.</p>",
          author: "Infrastructure",
          daysAgo: 7,
        }),
        article({
          id: "demo-article-dedupe",
          title: "Article deduplication now handles missing GUIDs",
          content:
            "<p>When feeds omit GUIDs, a content fingerprint fallback prevents duplicate imports. This was the most common source of duplicate articles reported by users.</p><p>The deduplication system works in two tiers. Tier one relies on the feed's GUID/permaLink element, which RSS and Atom specs define as a unique identifier for each entry. A partial unique index on <code>(feed_id, guid)</code> prevents two articles with the same feed and GUID from being inserted. This covers roughly 70% of feeds.</p><p>Tier two handles the remaining 30% where feeds omit GUIDs or use empty values. The system computes a content fingerprint by taking the first 1024 characters of the article content, normalizing whitespace, lowercasing, and running it through a fast hash (xxhash64). A second partial unique index on <code>(feed_id, content_fingerprint)</code> where <code>guid IS NULL</code> catches duplicates.</p><p>Both tiers are implemented as database-level constraints rather than application logic. This ensures deduplication is atomic and consistent even when multiple workers fetch the same feed concurrently — a scenario that becomes more common as the reader base grows.</p>",
          author: "Engineering",
          daysAgo: 10,
        }),
      ],
    },
    {
      id: "demo-feed-design-system",
      title: "Design System Updates",
      customTitle: "Design",
      description: "Weekly design system changelog and component previews.",
      url: "https://example.com/design-system.xml",
      folderIds: ["demo-folder-design"],
      lastFetchedAt: daysAgo(1),
      lastFetchStatus: "success",
      lastFetchErrorCode: null,
      lastFetchErrorMessage: null,
      lastFetchErrorAt: null,
      createdAt: daysAgo(15),
      items: [
        article({
          id: "demo-article-tokens",
          title: "New color tokens for semantic states",
          content:
            "<p>Success, warning, error, and info now have dedicated token values. No more guessing which gray means what.</p><p>The token set follows a naming convention: <code>color.semantic.{state}.{property}.{strength}</code>. For example, <code>color.semantic.success.bg.default</code> gives you the background color for a success banner, while <code>color.semantic.error.text.muted</code> provides a subdued red for secondary error labels.</p><p>Each semantic state has four variants: <code>default</code> (the primary color), <code>muted</code> (reduced opacity), <code>bg</code> (background tint), and <code>border</code> (for outlines and dividers). This covers the vast majority of UI patterns without forcing designers to invent ad-hoc values.</p><p>The token values are defined as CSS custom properties on <code>:root</code> and <code>:root[data-theme=\"dark\"]</code>, so they switch automatically with the theme. The actual hex values were calibrated using the APCA contrast algorithm to ensure WCAG 2.1 AA compliance across all combinations of foreground and background tokens.</p>",
          author: "Design Systems",
          daysAgo: 2,
        }),
        article({
          id: "demo-article-type-scale",
          title: "Type scale expanded to 12 steps",
          content:
            "<p>The new scale adds 5xs and 4xl to give designers more precision for data-dense screens and hero sections.</p><p>The type scale follows a modular ratio of 1.25 (major third) starting from a base of 14px. Each step is computed as <code>base * ratio^n</code> where n ranges from -2 (5xs) to +9 (4xl). The full scale: 5xs (9px), 4xs (11px), 3xs (12px), 2xs (13px), xs (14px), sm (16px), md (18px), lg (22px), xl (28px), 2xl (34px), 3xl (42px), 4xl (52px).</p><p>The two new steps were added based on usage patterns. 5xs fills a gap for dense data tables and code snippets where every pixel matters. 4xl was requested by the marketing team for landing page hero headings that need visual impact without resorting to arbitrary font sizes.</p><p>Line heights are tied to each step rather than using a global multiplier. Small sizes (5xs through xs) use a tighter 1.4 ratio, body sizes use 1.6, and display sizes use 1.2. This prevents the awkward excess vertical space that a fixed line-height multiplier creates at extreme sizes.</p>",
          author: "Design Systems",
          daysAgo: 6,
        }),
        article({
          id: "demo-article-icons",
          title: "Icon set refreshed with 24 new symbols",
          content:
            "<p>All icons are now 16px baseline with consistent 1.5px stroke weight. No more mixed stroke widths.</p><p>The icon refresh standardized on a 16x16 viewBox with 1.5px stroke weight and rounded caps. Previous icons were a mix of 14px, 16px, and 18px viewBoxes with stroke weights ranging from 1px to 2px, which created visible inconsistency in the sidebar and toolbar.</p><p>Each icon is built from a minimal set of geometric primitives: lines, arcs, and circles. No filled shapes — every icon is stroked. This ensures crisp rendering at small sizes and consistent appearance across light and dark modes. The 1.5px stroke was chosen as the sweet spot between visibility at 16px and visual weight at 24px (where the icon is centered in a 24px touch target).</p><p>New symbols added include: feed, folder, tag, archive, filter, sort, share, export, import, search, settings, help, keyboard, sun, moon, bell, clock, check, close, plus, minus, chevron, external-link, and more-horizontal. Each icon has a corresponding <code>title</code> element for screen readers, and decorative icons in buttons use <code>aria-hidden=\"true\"</code>.</p>",
          author: "Design Systems",
          daysAgo: 9,
        }),
      ],
    },
    {
      id: "demo-feed-ui-snippets",
      title: "UI Snippets",
      customTitle: null,
      description: "Tiny frontend patterns and gotchas from the team.",
      url: "https://example.com/ui-snippets.xml",
      folderIds: ["demo-folder-design", "demo-folder-engineering"],
      lastFetchedAt: daysAgo(2),
      lastFetchStatus: "success",
      lastFetchErrorCode: null,
      lastFetchErrorMessage: null,
      lastFetchErrorAt: null,
      createdAt: daysAgo(14),
      items: [
        article({
          id: "demo-article-css-modules",
          title: "CSS Modules + :global for third-party overrides",
          content:
            "<p>Use <code>:global(.some-class)</code> inside a module file to escape scoping without losing the rest of your component's styles.</p><p>CSS Modules scope class names by default, generating unique hashes like <code>Button_root_a3f2</code> to prevent collisions. This works great for your own components but breaks when you need to style third-party widgets that expect specific global class names.</p><p>The <code>:global()</code> pseudo-selector lets you selectively escape scoping. Example:</p><pre><code>.root { composes: base from \"./shared.module.css\"; }\n:global(.flatpickr-calendar) { border-radius: 8px; }\n:global(.flatpickr-day.selected) { background: var(--color-accent); }</code></pre><p>Everything inside <code>:global()</code> is rendered as-is. Everything outside remains scoped. Use it sparingly — too many global selectors erode the benefits of CSS Modules. A good rule of thumb: one <code>:global</code> block per third-party widget being customized.</p>",
          author: "Frontend",
          daysAgo: 3,
          saved: true,
        }),
        article({
          id: "demo-article-server-only",
          title: "server-only catches leaked secrets at build time",
          content:
            "<p>Importing a server module on the client throws at build time, not in production. Always import it at the top of server files.</p><p>The <code>server-only</code> package is a tiny npm module that marks an entire file as server-only. If any client bundle attempts to import a file that imports <code>server-only</code>, the build fails with a clear error message. This is a safety net, not a security boundary — determined attackers can still inspect network responses — but it prevents accidental leaks of database queries, API keys, or internal logic into client bundles.</p><p>The pattern is simple: every file in <code>src/lib/server/</code> starts with <code>import \"server-only\"</code> as its first import. If a developer later imports a server module from a client component (perhaps through a shared utility), the build immediately errors. We caught two such leaks during development: a database query helper that was accidentally re-exported from a barrel file, and an auth utility that was used in a form validation hook.</p><p>Note that <code>server-only</code> only protects against client bundle inclusion. It does not prevent server-side code from accidentally accessing secrets it shouldn't. That's a separate concern handled by our environment variable validation at startup.</p>",
          author: "Frontend",
          daysAgo: 5,
        }),
        article({
          id: "demo-article-middleware",
          title: "Middleware matcher: keep the regex tight",
          content:
            "<p>A broad matcher slows every request. Exclude <code>_next/static</code> and file extensions explicitly.</p><p>Next.js middleware runs on every matching request. If your matcher is too broad — like <code>/(.*)</code> — every static asset request (images, fonts, scripts) goes through the middleware, adding unnecessary latency and compute cost. On Vercel, middleware runs at the edge, so broad matchers can significantly increase function invocations and costs.</p><p>The recommended approach is to use the negated pattern that ships with the Next.js template:</p><pre><code>matcher: [\n  \"/((?!_next|[^?]*\\\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)\",\n  \"/(api|trpc)(.*)\",\n]</code></pre><p>This excludes <code>_next/static</code> (Next.js internals) and all static file extensions while still running middleware on API routes and dynamic pages. If you need middleware on specific routes only, use an array of path patterns instead of a single broad regex.</p>",
          author: "Frontend",
          daysAgo: 8,
        }),
        article({
          id: "demo-article-form-state",
          title: "React Server Actions vs. client form state",
          content:
            "<p>Use hidden form fields for server-only data and <code>useActionState</code> for optimistic UI.</p><p>React Server Actions (RSA) let you handle form submissions directly on the server without building an API route. The form data is serialized and sent to the server, where the action function runs with full access to databases, auth, and other server-only modules.</p><p>The challenge comes when you need both server data and client-side state in the same form. The pattern we settled on: use hidden form fields for values the server needs to know (user ID, feed ID, pagination cursors) and let RSA parse those on submission. For optimistic updates (like marking an article as read before the server confirms), wrap the action with <code>useActionState</code> and handle pending states in the UI.</p><pre><code>const [state, formAction, isPending] = useActionState(toggleReadAction, null);\n\nreturn (\n  &lt;form action={formAction}&gt;\n    &lt;input type=\"hidden\" name=\"articleId\" value={article.id} /&gt;\n    &lt;button disabled={isPending}&gt;\n      {isPending ? \"Saving...\" : article.readAt ? \"Mark unread\" : \"Mark read\"}\n    &lt;/button&gt;\n  &lt;/form&gt;\n);</code></pre><p>Avoid mixing RSA with client-side state management libraries for the same form data. The two sources of truth will eventually diverge, and debugging stale state is harder than the alternative.</p>",
          author: "Frontend",
          daysAgo: 11,
          read: true,
        }),
      ],
    },
    {
      id: "demo-feed-quarterly",
      title: "Quarterly Review",
      customTitle: null,
      description: "Business and strategy updates from the leadership team.",
      url: "https://example.com/quarterly-review.xml",
      folderIds: ["demo-folder-business"],
      lastFetchedAt: daysAgo(5),
      lastFetchStatus: "success",
      lastFetchErrorCode: null,
      lastFetchErrorMessage: null,
      lastFetchErrorAt: null,
      createdAt: daysAgo(12),
      items: [
        article({
          id: "demo-article-q1-goals",
          title: "Q1 2026 goals and key results",
          content:
            "<p>Three pillars: reduce time-to-read, improve feed discovery, and harden the platform for scale.</p><p><strong>Pillar 1: Reduce time-to-read.</strong> The average reader spends 45 seconds navigating to an article before they start reading. Our goal is to cut that to under 15 seconds. Initiatives include: smarter keyboard navigation, a quick-read mode that strips clutter, and predictive prefetching of the next article based on reading speed. Early prototype data suggests the quick-read mode alone can save 10-12 seconds per article.</p><p><strong>Pillar 2: Improve feed discovery.</strong> Most new users subscribe to 2-3 feeds in their first week and then stop. We want to surface relevant feeds based on existing subscriptions, similar to \"readers also subscribed to\" recommendations. The discovery engine will use TF-IDF on feed descriptions and article content to find related feeds. Key result: 50% of active readers should have at least 10 feeds within 30 days.</p><p><strong>Pillar 3: Harden the platform.</strong> Feed fetching is the most failure-prone part of the system. We target 99.9% fetch success rate (up from ~98.5%) through better retry logic, feed health monitoring, and automatic feed format detection. We also want to reduce p95 API response time to under 200ms through query optimization and caching.</p>",
          author: "Leadership",
          daysAgo: 5,
        }),
        article({
          id: "demo-article-retention",
          title: "Reader retention improved 18% this quarter",
          content:
            "<p>Weekly active readers grew after the reading mode and keyboard shortcut releases.</p><p>The D7 retention rate (readers who return within 7 days of their first visit) increased from 34% to 40% over the quarter, a relative improvement of 18%. The biggest driver appears to be the reading mode feature, which strips away navigation chrome and presents articles in a clean, typography-focused view. Readers who used reading mode in their first session had a D7 retention rate of 52%.</p><p>Keyboard shortcuts were the second-largest contributor. Readers who discovered and used at least one keyboard shortcut (measured by analytics events) showed 28% higher session frequency than those who navigated exclusively by mouse. The \"Press ? for shortcuts\" hint in the footer was the primary discovery mechanism.</p><p>Areas for improvement: mobile retention still lags desktop by 15 percentage points. The mobile reading experience is functional but lacks the polish of the desktop version. A dedicated mobile layout pass is planned for Q2.</p>",
          author: "Analytics",
          daysAgo: 7,
          read: true,
        }),
      ],
    },
    {
      id: "demo-feed-changelog",
      title: "Changelog",
      customTitle: null,
      description: "Every deploy, no matter how small.",
      url: "https://example.com/changelog.xml",
      folderIds: [],
      lastFetchedAt: daysAgo(2),
      lastFetchStatus: "success",
      lastFetchErrorCode: null,
      lastFetchErrorMessage: null,
      lastFetchErrorAt: null,
      createdAt: daysAgo(8),
      items: [
        article({
          id: "demo-article-deploy-401",
          title: "Deploy 401: Fix feed parsing for Atom entries with no summary",
          content:
            "<p>Atom entries without a summary element now fall back to content or a blank state instead of crashing.</p><p>The Atom spec allows entries to omit the summary element entirely, using only the content element for the body. Our parser expected summary to always be present and threw a TypeError when accessing <code>.value</code> on undefined. The fix checks for summary before reading it and falls back to content if available.</p><p>This affected approximately 2% of Atom feeds in the wild. The bug was introduced in deploy 395 when we refactored the parser to support multiple content types.</p>",
          author: "Bot",
          daysAgo: 0,
          hoursAgo: 6,
        }),
        article({
          id: "demo-article-deploy-400",
          title: "Deploy 400: OPML import progress bar",
          content:
            "<p>Large OPML files now show per-feed progress instead of a blank screen.</p><p>The previous import flow fetched all feeds in parallel without any UI feedback. For OPML files with 50+ feeds, this could take 30-60 seconds with nothing but a spinning indicator. The new flow processes feeds sequentially (to avoid rate limiting) and updates a progress bar after each feed is fetched and validated.</p><p>The progress bar shows \"Importing X of Y feeds\" with a percentage bar. Failed feeds are noted in red at the end with a \"retry\" button. The import can also be cancelled mid-operation, leaving already-imported feeds in place.</p>",
          author: "Bot",
          daysAgo: 1,
        }),
        article({
          id: "demo-article-deploy-399",
          title: "Deploy 399: Increase article retention to 50 per feed",
          content:
            "<p>From 25 to 50. Older articles are pruned on the next fetch cycle.</p><p>Users with slow-updating feeds (weekly or monthly) were losing articles before they had a chance to read them. The retention window is now 50 articles per feed, ordered by <code>COALESCE(published_at, created_at) DESC</code>. When a feed fetch brings in new articles, the oldest ones beyond the 50-article limit are deleted.</p><p>This change also included a one-time migration that ran <code>DELETE FROM feed_items WHERE id IN (SELECT id FROM (SELECT id, ROW_NUMBER() OVER (PARTITION BY feed_id ORDER BY COALESCE(published_at, created_at) DESC) AS rn FROM feed_items) sub WHERE rn > 50)</code> to clean up existing feeds that had accumulated more than 50 articles.</p>",
          author: "Bot",
          daysAgo: 3,
          read: true,
        }),
        article({
          id: "demo-article-deploy-398",
          title: "Deploy 398: Fix pagination cursor for feeds with identical timestamps",
          content:
            "<p>Cursor-based pagination now breaks ties using UUID ordering.</p><p>When two articles had the exact same <code>published_at</code> timestamp, cursor-based pagination could skip or duplicate articles. The cursor used <code>(published_at, id)</code> but the <code>ORDER BY</code> clause only specified <code>published_at DESC</code>, leaving the order of same-timestamp articles undefined.</p><p>The fix adds <code>id DESC</code> as a secondary sort key in both the cursor encoding and the query ordering. This guarantees deterministic ordering regardless of timestamp collisions. The cursor format changed from base64(published_at) to base64(published_at + \":\" + id), which is backwards-compatible on the decoding side.</p>",
          author: "Bot",
          daysAgo: 5,
          read: true,
        }),
        article({
          id: "demo-article-deploy-397",
          title: "Deploy 397: Add content fingerprint fallback for GUID-less items",
          content:
            "<p>Partial unique index on (feed_id, content_fingerprint) prevents duplicates when guid is null.</p><p>Roughly 30% of RSS feeds either omit the GUID element or use a generic value like a timestamp. Our previous deduplication relied solely on GUID, which meant these feeds accumulated duplicates on every fetch. The content fingerprint approach hashes the first 1024 characters of normalized content and uses that as a fallback unique key.</p><p>The index is partial — it only applies to rows where guid IS NULL — so it doesn't affect the fast path for feeds that provide proper GUIDs. The fingerprint function is deterministic and handles whitespace normalization so minor formatting differences don't create false positives.</p>",
          author: "Bot",
          daysAgo: 7,
        }),
      ],
    },
    {
      id: "demo-feed-broken-auth",
      title: "Private Newsletter Archive",
      customTitle: null,
      description: "A feed that requires authentication.",
      url: "https://example.com/private-newsletter.xml",
      folderIds: [],
      lastFetchedAt: daysAgo(3),
      lastFetchStatus: "error",
      lastFetchErrorCode: "auth_required",
      lastFetchErrorMessage:
        "This feed requires authentication. Add credentials in feed settings to fetch it.",
      lastFetchErrorAt: daysAgo(3),
      createdAt: daysAgo(6),
      items: [],
    },
    {
      id: "demo-feed-slow",
      title: "The Slow Reader",
      customTitle: null,
      description: "Infrequent long-form essays on technology and society.",
      url: "https://example.com/slow-reader.xml",
      folderIds: ["demo-folder-product"],
      lastFetchedAt: null,
      lastFetchStatus: null,
      lastFetchErrorCode: null,
      lastFetchErrorMessage: null,
      lastFetchErrorAt: null,
      createdAt: daysAgo(1),
      items: [],
    },
  ];
}
