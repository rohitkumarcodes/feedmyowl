"use client";

import { useCallback, useState } from "react";
import type { ArticleViewModel, FeedViewModel } from "@/features/feeds/types/view-models";
import type { SidebarScope } from "@/features/feeds/types/scopes";
import {
  deleteFeed as deleteFeedRequest,
  markAllItemsRead as markAllItemsReadRequest,
  markItemRead as markItemReadRequest,
  refreshFeeds as refreshFeedsRequest,
  renameFeed as renameFeedRequest,
  setFeedFolders as setFeedFoldersRequest,
} from "@/lib/client/feeds";
import { OFFLINE_CACHED_ARTICLES_MESSAGE } from "@/lib/shared/network-messages";

interface UseFeedCrudActionsOptions {
  allArticles: ArticleViewModel[];
  router: { refresh(): void };
  setFeeds: React.Dispatch<React.SetStateAction<FeedViewModel[]>>;
  setSelectedScope: React.Dispatch<React.SetStateAction<SidebarScope>>;
  setLiveMessage: React.Dispatch<React.SetStateAction<string>>;
  setNetworkMessage: React.Dispatch<React.SetStateAction<string | null>>;
  setInfoMessage: (message: string | null) => void;
  setErrorMessage: (message: string | null) => void;
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
        if (result.networkError) {
          setErrorMessage("Could not connect to the server.");
          return;
        }

        setErrorMessage(result.body?.error || "Unable to persist read state.");
      }
    },
    [allArticles, setErrorMessage, setFeeds],
  );

  /**
   * Mark all unread articles in the given scope as read.
   * Optimistically updates client state then persists on the server.
   */
  const markAllArticlesAsRead = useCallback(
    async (scopeType: string, scopeId?: string) => {
      /* Optimistic: set readAt on all unread items locally. */
      const optimisticReadAt = new Date().toISOString();
      setFeeds((previousFeeds) =>
        previousFeeds.map((feed) => ({
          ...feed,
          items: feed.items.map((item) =>
            item.readAt === null ? { ...item, readAt: optimisticReadAt } : item,
          ),
        })),
      );

      const result = await markAllItemsReadRequest(scopeType, scopeId);
      if (!result.ok) {
        if (result.networkError) {
          setErrorMessage("Could not connect to the server.");
          return;
        }

        setErrorMessage(result.body?.error || "Could not mark all as read.");
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
    [setErrorMessage, setFeeds, setInfoMessage],
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
      if (result.networkError) {
        setErrorMessage("Could not connect to the server.");
      } else {
        setErrorMessage(result.body?.error || "Could not refresh feeds.");
      }
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
        if (result.networkError) {
          setErrorMessage("Could not connect to the server.");
        } else {
          setErrorMessage(result.body?.error || "Could not delete feed.");
        }
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
        if (result.networkError) {
          setErrorMessage("Could not connect to the server.");
        } else {
          setErrorMessage(result.body?.error || "Could not update feed name.");
        }
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
        if (result.networkError) {
          setErrorMessage("Could not connect to the server.");
        } else {
          setErrorMessage(result.body?.error || "Could not update feed folders.");
        }
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
    markArticleAsRead,
    markAllArticlesAsRead,
    handleRefresh,
    handleDeleteFeed,
    handleRenameFeed,
    handleSetFeedFolders,
  };
}
