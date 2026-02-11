import type { ArticlePageItem } from "@/lib/article-pagination";
import type { FeedItemViewModel, FeedViewModel } from "./feeds-types";

export interface ScopePaginationState {
  initialized: boolean;
  isLoading: boolean;
  error: string | null;
  nextCursor: string | null;
  hasMore: boolean;
}

export type PaginationByScopeKey = Record<string, ScopePaginationState>;

export function createUninitializedScopePaginationState(): ScopePaginationState {
  return {
    initialized: false,
    isLoading: false,
    error: null,
    nextCursor: null,
    hasMore: true,
  };
}

export function createInitialPaginationByScopeKey(params: {
  scopeKey: string;
  nextCursor: string | null;
  hasMore: boolean;
}): PaginationByScopeKey {
  return {
    [params.scopeKey]: {
      initialized: true,
      isLoading: false,
      error: null,
      nextCursor: params.nextCursor,
      hasMore: params.hasMore,
    },
  };
}

export function getScopePaginationState(
  paginationByScopeKey: PaginationByScopeKey,
  scopeKey: string
): ScopePaginationState {
  return paginationByScopeKey[scopeKey] ?? createUninitializedScopePaginationState();
}

export function setScopePaginationLoading(
  paginationByScopeKey: PaginationByScopeKey,
  scopeKey: string
): PaginationByScopeKey {
  const previous = getScopePaginationState(paginationByScopeKey, scopeKey);
  return {
    ...paginationByScopeKey,
    [scopeKey]: {
      ...previous,
      initialized: true,
      isLoading: true,
      error: null,
    },
  };
}

export function setScopePaginationSuccess(
  paginationByScopeKey: PaginationByScopeKey,
  scopeKey: string,
  params: {
    nextCursor: string | null;
    hasMore: boolean;
  }
): PaginationByScopeKey {
  return {
    ...paginationByScopeKey,
    [scopeKey]: {
      initialized: true,
      isLoading: false,
      error: null,
      nextCursor: params.nextCursor,
      hasMore: params.hasMore,
    },
  };
}

export function setScopePaginationError(
  paginationByScopeKey: PaginationByScopeKey,
  scopeKey: string,
  error: string
): PaginationByScopeKey {
  const previous = getScopePaginationState(paginationByScopeKey, scopeKey);
  return {
    ...paginationByScopeKey,
    [scopeKey]: {
      ...previous,
      initialized: true,
      isLoading: false,
      error,
    },
  };
}

export function resetPaginationForServerRefresh(
  previousPaginationByScopeKey: PaginationByScopeKey,
  params: {
    allScopeKey: string;
    nextCursor: string | null;
    hasMore: boolean;
  }
): PaginationByScopeKey {
  const next: PaginationByScopeKey = {
    [params.allScopeKey]: {
      initialized: true,
      isLoading: false,
      error: null,
      nextCursor: params.nextCursor,
      hasMore: params.hasMore,
    },
  };

  for (const key of Object.keys(previousPaginationByScopeKey)) {
    if (key === params.allScopeKey) {
      continue;
    }

    next[key] = createUninitializedScopePaginationState();
  }

  return next;
}

function dedupeFeedItemsById(items: FeedItemViewModel[]): FeedItemViewModel[] {
  const seen = new Set<string>();
  const deduped: FeedItemViewModel[] = [];

  for (const item of items) {
    if (seen.has(item.id)) {
      continue;
    }

    seen.add(item.id);
    deduped.push(item);
  }

  return deduped;
}

function toFeedItemViewModel(item: ArticlePageItem): FeedItemViewModel {
  return {
    id: item.id,
    title: item.title,
    link: item.link,
    content: item.content,
    author: item.author,
    publishedAt: item.publishedAt,
    readAt: item.readAt,
    createdAt: item.createdAt,
  };
}

export function appendPageItemsToFeeds(
  currentFeeds: FeedViewModel[],
  pageItems: ArticlePageItem[]
): FeedViewModel[] {
  if (pageItems.length === 0) {
    return currentFeeds;
  }

  const pageItemsByFeedId = new Map<string, FeedItemViewModel[]>();
  for (const item of pageItems) {
    const existing = pageItemsByFeedId.get(item.feedId) ?? [];
    existing.push(toFeedItemViewModel(item));
    pageItemsByFeedId.set(item.feedId, existing);
  }

  return currentFeeds.map((feed) => {
    const incomingFeedItems = pageItemsByFeedId.get(feed.id);
    if (!incomingFeedItems || incomingFeedItems.length === 0) {
      return feed;
    }

    return {
      ...feed,
      items: dedupeFeedItemsById([...feed.items, ...incomingFeedItems]),
    };
  });
}

export function mergeServerFeedsWithLoadedItems(
  currentFeeds: FeedViewModel[],
  incomingFeeds: FeedViewModel[]
): FeedViewModel[] {
  const currentById = new Map(currentFeeds.map((feed) => [feed.id, feed]));

  return incomingFeeds.map((incomingFeed) => {
    const currentFeed = currentById.get(incomingFeed.id);
    if (!currentFeed) {
      return incomingFeed;
    }

    return {
      ...incomingFeed,
      items: dedupeFeedItemsById([...incomingFeed.items, ...currentFeed.items]),
    };
  });
}

