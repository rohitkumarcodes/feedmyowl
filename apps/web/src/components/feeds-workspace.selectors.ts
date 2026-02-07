import type { SidebarScope } from "./Sidebar";
import type { ArticleViewModel, FeedViewModel } from "./feeds-types";
import { extractArticleSnippet } from "@/utils/articleText";

/**
 * Builds a readable feed label from title or URL fallback.
 */
export function getFeedLabel(feed: FeedViewModel): string {
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
        extractedHtml: item.extractedHtml || null,
        extractedAt: item.extractedAt || null,
        extractionStatus: item.extractionStatus || null,
        extractionSource: item.extractionSource || null,
        createdAt: item.createdAt,
        feedId: feed.id,
        feedTitle: getFeedLabel(feed),
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
  if (selectedScope.type === "feed") {
    return allArticles.filter((article) => article.feedId === selectedScope.feedId);
  }

  return allArticles;
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
  selectedScope: SidebarScope
): string {
  if (selectedScope.type === "all") {
    return "All articles";
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
  if (selectedScope.type === "feed") {
    const feed = feeds.find((candidate) => candidate.id === selectedScope.feedId);
    return feed?.lastFetchErrorMessage || null;
  }

  const erroredFeed = feeds.find(
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
  if (feedCount === 0) {
    return "Add a feed to get started.";
  }

  if (selectedScope.type === "feed") {
    return "No articles in this feed.";
  }

  return "No articles yet. Refresh to load the latest posts.";
}
