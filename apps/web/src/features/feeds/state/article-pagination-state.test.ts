import { describe, expect, it } from "vitest";
import {
  appendPageItemsToFeeds,
  createInitialPaginationByScopeKey,
  createUninitializedScopePaginationState,
  getScopePaginationState,
  mergeServerFeedsWithLoadedItems,
  resetPaginationForServerRefresh,
  setScopePaginationError,
  setScopePaginationLoading,
  setScopePaginationSuccess,
} from "./article-pagination-state";
import type { FeedViewModel } from "@/features/feeds/types/view-models";

function createFeed(overrides: Partial<FeedViewModel>): FeedViewModel {
  return {
    id: overrides.id || "feed_1",
    title: overrides.title ?? "Feed",
    customTitle: overrides.customTitle ?? null,
    description: overrides.description ?? null,
    url: overrides.url || "https://example.com/feed.xml",
    folderIds: overrides.folderIds ?? [],
    lastFetchedAt: overrides.lastFetchedAt ?? null,
    lastFetchStatus: overrides.lastFetchStatus ?? null,
    lastFetchErrorCode: overrides.lastFetchErrorCode ?? null,
    lastFetchErrorMessage: overrides.lastFetchErrorMessage ?? null,
    lastFetchErrorAt: overrides.lastFetchErrorAt ?? null,
    createdAt: overrides.createdAt || "2026-02-11T00:00:00.000Z",
    items: overrides.items ?? [],
  };
}

describe("article pagination state helpers", () => {
  it("appends page items to matching feeds and dedupes by item id", () => {
    const feeds = [
      createFeed({
        id: "feed_1",
        items: [
          {
            id: "item_1",
            title: "One",
            link: null,
            content: null,
            author: null,
            publishedAt: null,
            readAt: null,
            createdAt: "2026-02-11T00:00:00.000Z",
          },
        ],
      }),
      createFeed({
        id: "feed_2",
        items: [],
      }),
    ];

    const appended = appendPageItemsToFeeds(feeds, [
      {
        id: "item_1",
        feedId: "feed_1",
        title: "One (duplicate)",
        link: null,
        content: null,
        author: null,
        publishedAt: null,
        readAt: null,
        createdAt: "2026-02-11T00:00:00.000Z",
      },
      {
        id: "item_2",
        feedId: "feed_1",
        title: "Two",
        link: null,
        content: null,
        author: null,
        publishedAt: null,
        readAt: null,
        createdAt: "2026-02-12T00:00:00.000Z",
      },
      {
        id: "item_3",
        feedId: "feed_2",
        title: "Three",
        link: null,
        content: null,
        author: null,
        publishedAt: null,
        readAt: null,
        createdAt: "2026-02-12T00:00:00.000Z",
      },
    ]);

    expect(appended[0].items.map((item) => item.id)).toEqual(["item_1", "item_2"]);
    expect(appended[1].items.map((item) => item.id)).toEqual(["item_3"]);
  });

  it("merges server feed metadata while preserving already-loaded items", () => {
    const currentFeeds = [
      createFeed({
        id: "feed_1",
        title: "Current title",
        items: [
          {
            id: "item_old",
            title: "Old",
            link: null,
            content: null,
            author: null,
            publishedAt: null,
            readAt: null,
            createdAt: "2026-02-01T00:00:00.000Z",
          },
        ],
      }),
    ];

    const incomingFeeds = [
      createFeed({
        id: "feed_1",
        title: "Server title",
        items: [
          {
            id: "item_new",
            title: "New",
            link: null,
            content: null,
            author: null,
            publishedAt: null,
            readAt: null,
            createdAt: "2026-02-11T00:00:00.000Z",
          },
        ],
      }),
    ];

    const merged = mergeServerFeedsWithLoadedItems(currentFeeds, incomingFeeds);
    expect(merged[0].title).toBe("Server title");
    expect(merged[0].items.map((item) => item.id)).toEqual(["item_new", "item_old"]);
  });

  it("handles pagination state transitions and refresh reset", () => {
    const allScopeKey = "all";
    const initial = createInitialPaginationByScopeKey({
      scopeKey: allScopeKey,
      nextCursor: "cursor_1",
      hasMore: true,
    });

    const loading = setScopePaginationLoading(initial, "folder:abc");
    expect(getScopePaginationState(loading, "folder:abc").isLoading).toBe(true);

    const success = setScopePaginationSuccess(loading, "folder:abc", {
      nextCursor: "cursor_2",
      hasMore: false,
    });
    expect(getScopePaginationState(success, "folder:abc")).toEqual({
      initialized: true,
      isLoading: false,
      error: null,
      nextCursor: "cursor_2",
      hasMore: false,
    });

    const errored = setScopePaginationError(success, "feed:xyz", "Could not load.");
    expect(getScopePaginationState(errored, "feed:xyz").error).toBe("Could not load.");

    const refreshed = resetPaginationForServerRefresh(errored, {
      allScopeKey,
      nextCursor: null,
      hasMore: false,
    });
    expect(getScopePaginationState(refreshed, allScopeKey)).toEqual({
      initialized: true,
      isLoading: false,
      error: null,
      nextCursor: null,
      hasMore: false,
    });
    expect(getScopePaginationState(refreshed, "folder:abc")).toEqual(
      createUninitializedScopePaginationState(),
    );
    expect(getScopePaginationState(refreshed, "feed:xyz")).toEqual(
      createUninitializedScopePaginationState(),
    );
  });
});
