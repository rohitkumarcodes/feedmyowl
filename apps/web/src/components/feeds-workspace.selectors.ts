import type { SidebarScope } from "./Sidebar";
import type {
  ArticleViewModel,
  FeedViewModel,
  FolderViewModel,
} from "./feeds-types";
import { extractArticleSnippet } from "@/utils/articleText";

/**
 * Returns true when an article belongs to the selected sidebar scope.
 * Kept as a single source of truth so list/reader behaviors stay in sync.
 */
export function doesArticleMatchSidebarScope(
  article: ArticleViewModel,
  selectedScope: SidebarScope
): boolean {
  if (selectedScope.type === "none") {
    return false;
  }

  if (selectedScope.type === "all") {
    return true;
  }

  if (selectedScope.type === "feed") {
    return article.feedId === selectedScope.feedId;
  }

  if (selectedScope.type === "folder") {
    return article.feedFolderIds.includes(selectedScope.folderId);
  }

  return article.feedFolderIds.length === 0;
}

/**
 * Builds a readable feed label from title or URL fallback.
 */
export function getFeedLabel(feed: FeedViewModel): string {
  if (feed.customTitle?.trim()) {
    return feed.customTitle.trim();
  }

  if (feed.title?.trim()) {
    return feed.title.trim();
  }

  try {
    return new URL(feed.url).hostname.replace(/^www\./, "");
  } catch {
    return feed.url;
  }
}

/**
 * Converts ISO values into comparable numeric timestamps.
 */
function toTimeValue(iso: string | null): number {
  if (!iso) {
    return 0;
  }

  const parsed = Date.parse(iso);
  return Number.isNaN(parsed) ? 0 : parsed;
}

/**
 * Flattens feed items into article view models sorted newest first.
 */
export function selectAllArticles(feeds: FeedViewModel[]): ArticleViewModel[] {
  const flattened = feeds.flatMap((feed) =>
    feed.items.map(
      (item): ArticleViewModel => ({
        id: item.id,
        title: item.title || "Untitled article",
        link: item.link,
        content: item.content,
        author: item.author,
        publishedAt: item.publishedAt,
        readAt: item.readAt,
        createdAt: item.createdAt,
        feedId: feed.id,
        feedTitle: getFeedLabel(feed),
        feedFolderIds: feed.folderIds,
        snippet: extractArticleSnippet(item.content),
      })
    )
  );

  flattened.sort((a, b) => {
    const aDate = toTimeValue(a.publishedAt) || toTimeValue(a.createdAt);
    const bDate = toTimeValue(b.publishedAt) || toTimeValue(b.createdAt);
    return bDate - aDate;
  });

  return flattened;
}

/**
 * Returns the active article list for the selected sidebar scope.
 */
export function selectVisibleArticles(
  allArticles: ArticleViewModel[],
  selectedScope: SidebarScope
): ArticleViewModel[] {
  return allArticles.filter((article) =>
    doesArticleMatchSidebarScope(article, selectedScope)
  );
}

/**
 * Resolves the currently open article by id.
 */
export function selectOpenArticle(
  allArticles: ArticleViewModel[],
  openArticleId: string | null
): ArticleViewModel | null {
  return allArticles.find((article) => article.id === openArticleId) || null;
}

/**
 * Human-readable title used for the mobile article-list pane.
 */
export function selectScopeLabel(
  feeds: FeedViewModel[],
  folders: FolderViewModel[],
  selectedScope: SidebarScope
): string {
  if (selectedScope.type === "none") {
    return "Feeds";
  }

  if (selectedScope.type === "all") {
    return "All feeds";
  }

  if (selectedScope.type === "uncategorized") {
    return "Uncategorized";
  }

  if (selectedScope.type === "folder") {
    const folder = folders.find((candidate) => candidate.id === selectedScope.folderId);
    return folder?.name || "Folder";
  }

  const feed = feeds.find((candidate) => candidate.id === selectedScope.feedId);
  return feed ? getFeedLabel(feed) : "Articles";
}

/**
 * Inline list status message showing the latest fetch error when present.
 */
export function selectListStatusMessage(
  feeds: FeedViewModel[],
  selectedScope: SidebarScope
): string | null {
  if (selectedScope.type === "none") {
    return null;
  }

  const scopedFeeds =
    selectedScope.type === "feed"
      ? feeds.filter((candidate) => candidate.id === selectedScope.feedId)
      : selectedScope.type === "folder"
        ? feeds.filter((candidate) => candidate.folderIds.includes(selectedScope.folderId))
        : selectedScope.type === "uncategorized"
          ? feeds.filter((candidate) => candidate.folderIds.length === 0)
          : feeds;

  const erroredFeed = scopedFeeds.find(
    (feed) => feed.lastFetchStatus === "error" && feed.lastFetchErrorMessage
  );
  return erroredFeed?.lastFetchErrorMessage || null;
}

/**
 * Empty-state text for the article list pane.
 */
export function selectEmptyStateMessage(
  feedCount: number,
  selectedScope: SidebarScope
): string {
  if (selectedScope.type === "none") {
    return "Select a feed from the left panel.";
  }

  if (feedCount === 0) {
    return "Add a feed to get started.";
  }

  if (selectedScope.type === "feed") {
    return "No articles in this feed.";
  }

  if (selectedScope.type === "folder") {
    return "No articles in this folder.";
  }

  if (selectedScope.type === "uncategorized") {
    return "No uncategorized articles.";
  }

  return "No articles yet. Refresh to load the latest posts.";
}
