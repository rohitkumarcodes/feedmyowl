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

function article(params: {
  id: string;
  title: string;
  content: string;
  author: string;
  daysAgo: number;
  read?: boolean;
  saved?: boolean;
}): FeedItemViewModel {
  const createdAt = daysAgo(params.daysAgo);
  return {
    id: params.id,
    title: params.title,
    link: `https://example.com/${params.id}`,
    content: params.content,
    author: params.author,
    publishedAt: createdAt,
    readAt: params.read ? daysAgo(Math.max(params.daysAgo - 1, 0)) : null,
    savedAt: params.saved ? daysAgo(Math.max(params.daysAgo - 1, 0)) : null,
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
            "<p>The import flow validates feeds first, then lets the reader decide when to apply the changes.</p>",
          author: "FeedMyOwl",
          daysAgo: 0,
          saved: true,
        }),
        article({
          id: "demo-article-shortcuts",
          title: "Keyboard shortcuts are easier to discover",
          content:
            "<p>The sidebar now gives readers a calmer way to find and use shortcut help.</p>",
          author: "FeedMyOwl",
          daysAgo: 2,
          read: true,
        }),
      ],
    },
    {
      id: "demo-feed-platform",
      title: "Platform Notes",
      customTitle: null,
      description: "Reliability and backend notes.",
      url: "https://example.com/platform.xml",
      folderIds: ["demo-folder-engineering"],
      lastFetchedAt: daysAgo(1),
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
            "<p>Database, auth, payments, email, feed parsing, and error tracking each stay behind one local module.</p>",
          author: "Engineering",
          daysAgo: 1,
        }),
      ],
    },
    {
      id: "demo-feed-reading",
      title: "Calm Reading",
      customTitle: null,
      description: "Uncategorized sample feed for sidebar smoke tests.",
      url: "https://example.com/calm-reading.xml",
      folderIds: [],
      lastFetchedAt: daysAgo(4),
      lastFetchStatus: "error",
      lastFetchErrorCode: "timeout",
      lastFetchErrorMessage:
        "This feed could not be updated. The server did not respond in time.",
      lastFetchErrorAt: daysAgo(4),
      createdAt: daysAgo(10),
      items: [
        article({
          id: "demo-article-reading-stack",
          title: "A quiet reading stack beats a busy dashboard",
          content: "<p>FeedMyOwl keeps the loop simple: add, refresh, choose, read.</p>",
          author: "Editorial",
          daysAgo: 4,
        }),
      ],
    },
  ];
}
