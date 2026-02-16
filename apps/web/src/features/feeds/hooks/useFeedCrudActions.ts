"use client";

import { useCallback, useState } from "react";
import type { ArticleViewModel, FeedViewModel } from "@/features/feeds/types/view-models";
import type { SidebarScope } from "@/features/feeds/types/scopes";
import type { FeedActionNoticeOptions } from "@/features/feeds/hooks/useFeedActionStatus";
import {
  deleteFeed as deleteFeedRequest,
  markAllItemsRead as markAllItemsReadRequest,
  markItemRead as markItemReadRequest,
  refreshFeeds as refreshFeedsRequest,
  renameFeed as renameFeedRequest,
  setFeedFolders as setFeedFoldersRequest,
  setItemSaved as setItemSavedRequest,
} from "@/lib/client/feeds";
import type { ApiErrorBody } from "@/contracts/api/common";
import { OFFLINE_CACHED_ARTICLES_MESSAGE } from "@/lib/shared/network-messages";
import { mapApiCallResultToUiMessage, type UiActionContext } from "@/lib/shared/ui-messages";

interface UseFeedCrudActionsOptions {
  allArticles: ArticleViewModel[];
  router: { refresh(): void };
  setFeeds: React.Dispatch<React.SetStateAction<FeedViewModel[]>>;
  setSelectedScope: React.Dispatch<React.SetStateAction<SidebarScope>>;
  setLiveMessage: React.Dispatch<React.SetStateAction<string>>;
  setNetworkMessage: React.Dispatch<React.SetStateAction<string | null>>;
  setInfoMessage: (message: string | null, options?: FeedActionNoticeOptions) => void;
  setErrorMessage: (message: string | null, options?: FeedActionNoticeOptions) => void;
  setShowAddAnotherAction: React.Dispatch<React.SetStateAction<boolean>>;
}

export function useFeedCrudActions({
  allArticles,
  router,
  setFeeds,
  setSelectedScope,
  setLiveMessage,
  setNetworkMessage,
  setInfoMessage,
  setErrorMessage,
  setShowAddAnotherAction,
}: UseFeedCrudActionsOptions) {
  const [isRefreshingFeeds, setIsRefreshingFeeds] = useState(false);
  const [deletingFeedId, setDeletingFeedId] = useState<string | null>(null);
  const [renamingFeedId, setRenamingFeedId] = useState<string | null>(null);
  const [updatingFeedFoldersId, setUpdatingFeedFoldersId] = useState<string | null>(null);
  const [savingItemId, setSavingItemId] = useState<string | null>(null);

  const handleApiFailure = useCallback(
    (
      result: {
        status: number;
        networkError: boolean;
        body: Partial<ApiErrorBody> | null;
        headers: Headers | null;
      },
      context: UiActionContext,
      fallbackMessage: string,
      retryAction?: () => void,
    ) => {
      const mapped = mapApiCallResultToUiMessage(result, context, fallbackMessage);
      setErrorMessage(mapped.text, {
        severity: mapped.severity,
        title: mapped.title,
        dedupeKey: mapped.dedupeKey,
        source: "workspace",
        retryAction:
          retryAction && mapped.recommendedActionLabel === "Retry"
            ? {
                label: "Retry",
                onAction: retryAction,
              }
            : undefined,
      });
    },
    [setErrorMessage],
  );

  const markArticleAsRead = useCallback(
    async (articleId: string) => {
      const article = allArticles.find((candidate) => candidate.id === articleId);

      if (!article || article.readAt) {
        return;
      }

      const optimisticReadAt = new Date().toISOString();
      setFeeds((previousFeeds) =>
        previousFeeds.map((feed) => {
          if (feed.id !== article.feedId) {
            return feed;
          }

          return {
            ...feed,
            items: feed.items.map((item) =>
              item.id === articleId ? { ...item, readAt: optimisticReadAt } : item,
            ),
          };
        }),
      );

      const result = await markItemReadRequest(articleId);
      if (!result.ok) {
        handleApiFailure(result, "article.mark_read", "Couldn't update read state. Try again.");
      }
    },
    [allArticles, handleApiFailure, setFeeds],
  );

  /**
   * Mark all unread articles in the given scope as read.
   * Optimistically updates client state then persists on the server.
   */
  const markAllArticlesAsRead = useCallback(
    async (scopeType: string, scopeId?: string) => {
      /* Optimistic: set readAt on unread items locally in the specified scope. */
      const optimisticReadAt = new Date().toISOString();
      setFeeds((previousFeeds) =>
        previousFeeds.map((feed) => {
          const feedMatchesScope =
            scopeType === "all" ||
            scopeType === "unread" ||
            scopeType === "saved" ||
            (scopeType === "feed" && feed.id === scopeId) ||
            (scopeType === "folder" && scopeId ? feed.folderIds.includes(scopeId) : false) ||
            (scopeType === "uncategorized" && feed.folderIds.length === 0);

          if (!feedMatchesScope) {
            return feed;
          }

          return {
            ...feed,
            items: feed.items.map((item) => {
              const shouldMarkSavedOnly = scopeType === "saved";
              const isInScope = shouldMarkSavedOnly ? item.savedAt != null : true;

              return item.readAt === null && isInScope
                ? { ...item, readAt: optimisticReadAt }
                : item;
            }),
          };
        }),
      );

      const result = await markAllItemsReadRequest(scopeType, scopeId);
      if (!result.ok) {
        handleApiFailure(
          result,
          "article.mark_all_read",
          "Couldn't mark all articles as read. Try again.",
        );
        return;
      }

      const markedCount =
        result.body && "markedCount" in result.body ? result.body.markedCount : 0;
      setInfoMessage(
        markedCount > 0
          ? `Marked ${markedCount} article${markedCount === 1 ? "" : "s"} as read.`
          : "All articles are already read.",
      );
    },
    [handleApiFailure, setFeeds, setInfoMessage],
  );

  const toggleArticleSaved = useCallback(
    async (articleId: string) => {
      if (savingItemId) {
        return;
      }

      const article = allArticles.find((candidate) => candidate.id === articleId);
      if (!article) {
        return;
      }

      const wasSaved = article.savedAt != null;
      const nextSaved = !wasSaved;
      const previousSavedAt = article.savedAt ?? null;
      const optimisticSavedAt = nextSaved ? new Date().toISOString() : null;

      setFeeds((previousFeeds) =>
        previousFeeds.map((feed) => {
          if (feed.id !== article.feedId) {
            return feed;
          }

          return {
            ...feed,
            items: feed.items.map((item) =>
              item.id === articleId ? { ...item, savedAt: optimisticSavedAt } : item,
            ),
          };
        }),
      );

      setSavingItemId(articleId);

      const result = await setItemSavedRequest(articleId, nextSaved);
      setSavingItemId(null);

      if (!result.ok) {
        // Revert optimistic update.
        setFeeds((previousFeeds) =>
          previousFeeds.map((feed) => {
            if (feed.id !== article.feedId) {
              return feed;
            }

            return {
              ...feed,
              items: feed.items.map((item) =>
                item.id === articleId ? { ...item, savedAt: previousSavedAt } : item,
              ),
            };
          }),
        );

        handleApiFailure(
          result,
          "article.set_saved",
          "Couldn't update saved state. Try again.",
        );
        return;
      }

      const persistedSavedAt =
        result.body && "savedAt" in result.body
          ? (result.body.savedAt ?? null)
          : optimisticSavedAt;

      setFeeds((previousFeeds) =>
        previousFeeds.map((feed) => {
          if (feed.id !== article.feedId) {
            return feed;
          }

          return {
            ...feed,
            items: feed.items.map((item) =>
              item.id === articleId ? { ...item, savedAt: persistedSavedAt } : item,
            ),
          };
        }),
      );
    },
    [allArticles, handleApiFailure, savingItemId, setFeeds],
  );

  const handleRefresh = useCallback(async () => {
    if (isRefreshingFeeds) {
      return;
    }

    if (!navigator.onLine) {
      setNetworkMessage(OFFLINE_CACHED_ARTICLES_MESSAGE);
      return;
    }

    setIsRefreshingFeeds(true);
    setInfoMessage(null);
    setErrorMessage(null);
    setShowAddAnotherAction(false);

    const result = await refreshFeedsRequest();
    if (!result.ok) {
      handleApiFailure(result, "feed.refresh", "Refresh didn't finish. Try again.", () => {
        void handleRefresh();
      });
      setIsRefreshingFeeds(false);
      return;
    }

    const addedCount =
      result.body?.results?.reduce(
        (total, row) => total + (row.status === "success" ? row.newItemCount : 0),
        0,
      ) || 0;

    const refreshMessage =
      addedCount > 0
        ? `Refresh complete. ${addedCount} new article${addedCount === 1 ? "" : "s"} added.`
        : "Refresh complete. No new articles this time.";

    setInfoMessage(refreshMessage);
    setLiveMessage(refreshMessage);
    setIsRefreshingFeeds(false);
    router.refresh();
  }, [
    isRefreshingFeeds,
    handleApiFailure,
    router,
    setErrorMessage,
    setInfoMessage,
    setLiveMessage,
    setNetworkMessage,
    setShowAddAnotherAction,
  ]);

  const handleDeleteFeed = useCallback(
    async (feedId: string) => {
      if (renamingFeedId || deletingFeedId || updatingFeedFoldersId) {
        return;
      }

      setDeletingFeedId(feedId);
      setInfoMessage(null);
      setErrorMessage(null);
      setShowAddAnotherAction(false);

      const result = await deleteFeedRequest(feedId);
      if (!result.ok) {
        handleApiFailure(result, "feed.delete", "Couldn't delete this feed. Try again.", () => {
          void handleDeleteFeed(feedId);
        });
        setDeletingFeedId(null);
        return;
      }

      setFeeds((previousFeeds) => previousFeeds.filter((feed) => feed.id !== feedId));

      setSelectedScope((previousScope) => {
        if (previousScope.type === "feed" && previousScope.feedId === feedId) {
          return { type: "all" };
        }
        return previousScope;
      });

      setInfoMessage("Feed deleted.");
      setDeletingFeedId(null);
      router.refresh();
    },
    [
      deletingFeedId,
      handleApiFailure,
      renamingFeedId,
      router,
      setErrorMessage,
      setFeeds,
      setInfoMessage,
      setSelectedScope,
      setShowAddAnotherAction,
      updatingFeedFoldersId,
    ],
  );

  const handleRenameFeed = useCallback(
    async (feedId: string, name: string): Promise<boolean> => {
      if (deletingFeedId || renamingFeedId || updatingFeedFoldersId) {
        return false;
      }

      setRenamingFeedId(feedId);
      setInfoMessage(null);
      setErrorMessage(null);
      setShowAddAnotherAction(false);

      const result = await renameFeedRequest(feedId, name);
      if (!result.ok) {
        handleApiFailure(
          result,
          "feed.rename",
          "Couldn't update this feed name. Try again.",
          () => {
            void handleRenameFeed(feedId, name);
          },
        );
        setRenamingFeedId(null);
        return false;
      }

      const nextCustomTitle = result.body?.feed?.customTitle ?? null;
      setFeeds((previousFeeds) =>
        previousFeeds.map((feed) =>
          feed.id === feedId ? { ...feed, customTitle: nextCustomTitle } : feed,
        ),
      );

      setInfoMessage(name.trim() ? "Feed name updated." : "Feed name reset.");
      setRenamingFeedId(null);
      router.refresh();
      return true;
    },
    [
      deletingFeedId,
      handleApiFailure,
      renamingFeedId,
      router,
      setErrorMessage,
      setFeeds,
      setInfoMessage,
      setShowAddAnotherAction,
      updatingFeedFoldersId,
    ],
  );

  const handleSetFeedFolders = useCallback(
    async (feedId: string, folderIds: string[]): Promise<boolean> => {
      if (deletingFeedId || renamingFeedId || updatingFeedFoldersId) {
        return false;
      }

      setUpdatingFeedFoldersId(feedId);
      setInfoMessage(null);
      setErrorMessage(null);
      setShowAddAnotherAction(false);

      const result = await setFeedFoldersRequest(feedId, folderIds);
      if (!result.ok) {
        handleApiFailure(
          result,
          "feed.set_folders",
          "Couldn't update folder assignments. Choose folders and try again.",
          () => {
            void handleSetFeedFolders(feedId, folderIds);
          },
        );
        setUpdatingFeedFoldersId(null);
        return false;
      }

      const nextFolderIds = result.body?.feed?.folderIds ?? [];
      setFeeds((previousFeeds) =>
        previousFeeds.map((feed) =>
          feed.id === feedId ? { ...feed, folderIds: nextFolderIds } : feed,
        ),
      );

      setInfoMessage(
        nextFolderIds.length > 0
          ? `Feed assigned to ${nextFolderIds.length} folder${
              nextFolderIds.length === 1 ? "" : "s"
            }.`
          : "Feed moved to Uncategorized.",
      );
      setUpdatingFeedFoldersId(null);
      router.refresh();
      return true;
    },
    [
      deletingFeedId,
      handleApiFailure,
      renamingFeedId,
      router,
      setErrorMessage,
      setFeeds,
      setInfoMessage,
      setShowAddAnotherAction,
      updatingFeedFoldersId,
    ],
  );

  return {
    isRefreshingFeeds,
    deletingFeedId,
    renamingFeedId,
    updatingFeedFoldersId,
    savingItemId,
    markArticleAsRead,
    markAllArticlesAsRead,
    toggleArticleSaved,
    handleRefresh,
    handleDeleteFeed,
    handleRenameFeed,
    handleSetFeedFolders,
  };
}
