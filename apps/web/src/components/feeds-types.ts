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
  extractedHtml?: string | null;
  extractedAt?: string | null;
  extractionStatus?: string | null;
  extractionSource?: string | null;
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
  lastFetchStatus?: string | null;
  lastFetchErrorCode?: string | null;
  lastFetchErrorMessage?: string | null;
  lastFetchErrorAt?: string | null;
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
  extractedHtml?: string | null;
  extractedAt?: string | null;
  extractionStatus?: string | null;
  extractionSource?: string | null;
  feedId: string;
  feedTitle: string;
  snippet: string;
}

/**
 * Describes a pending context-menu action awaiting user confirmation.
 * Used by the sidebar to render inline rename/move/delete forms.
 */
export type PendingAction =
  | {
      kind: "feed-rename";
      feedId: string;
      draftTitle: string;
    }
  | {
      kind: "folder-rename";
      folderId: string;
      draftName: string;
    }
  | {
      kind: "feed-move";
      feedId: string;
      draftFolderId: string;
    }
  | {
      kind: "feed-delete";
      feedId: string;
      feedLabel: string;
    }
  | {
      kind: "folder-delete";
      folderId: string;
      folderLabel: string;
    };
