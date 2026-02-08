/**
 * Shared view-model types used by the feed-reading UI components.
 */

/**
 * Represents a persisted article item returned from the backend.
 */
export interface FeedItemViewModel {
  id: string;
  title: string | null;
  link: string | null;
  content: string | null;
  author: string | null;
  publishedAt: string | null;
  readAt: string | null;
  createdAt: string;
}

/**
 * Represents one subscribed feed and its loaded article items.
 */
export interface FeedViewModel {
  id: string;
  title: string | null;
  customTitle: string | null;
  description: string | null;
  url: string;
  lastFetchedAt: string | null;
  lastFetchStatus?: string | null;
  lastFetchErrorCode?: string | null;
  lastFetchErrorMessage?: string | null;
  lastFetchErrorAt?: string | null;
  createdAt: string;
  items: FeedItemViewModel[];
}

/**
 * Flattened article shape used by article-list and reader components.
 */
export interface ArticleViewModel {
  id: string;
  title: string;
  link: string | null;
  content: string | null;
  author: string | null;
  publishedAt: string | null;
  createdAt: string;
  readAt: string | null;
  feedId: string;
  feedTitle: string;
  snippet: string;
}
