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
  description: string | null;
  url: string;
  folderId: string | null;
  lastFetchedAt: string | null;
  createdAt: string;
  items: FeedItemViewModel[];
}

/**
 * Represents one user-created folder used for sidebar grouping.
 */
export interface FolderViewModel {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
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
