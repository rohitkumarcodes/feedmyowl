"use client";

import { FormEvent, useCallback, useState } from "react";
import type { ArticleViewModel, FeedViewModel } from "@/components/feeds-types";
import type { SidebarScope } from "@/components/Sidebar";
import type { FeedsWorkspaceMobileView } from "@/hooks/useFeedsWorkspaceMobile";

interface ApiErrorResponse {
  error?: string;
  code?: string;
  message?: string;
}

interface RefreshResult {
  feedId: string;
  feedUrl: string;
  newItemCount: number;
  status: "success" | "error";
  errorCode?: string;
  errorMessage?: string;
}

interface RefreshResponse {
  results?: RefreshResult[];
  retentionDeletedCount?: number;
}

interface FeedCreateResponse {
  feed?: {
    id: string;
    title?: string | null;
    description?: string | null;
    url: string;
    lastFetchedAt?: string | null;
    lastFetchStatus?: string | null;
    lastFetchErrorCode?: string | null;
    lastFetchErrorMessage?: string | null;
    lastFetchErrorAt?: string | null;
    createdAt?: string;
  };
  duplicate?: boolean;
  message?: string;
}

interface UseFeedsWorkspaceActionsOptions {
  allArticles: ArticleViewModel[];
  isMobile: boolean;
  router: {
    refresh(): void;
  };
  setLiveMessage: React.Dispatch<React.SetStateAction<string>>;
  setFeeds: React.Dispatch<React.SetStateAction<FeedViewModel[]>>;
  setSelectedScope: React.Dispatch<React.SetStateAction<SidebarScope>>;
  setMobileViewWithHistory: (
    nextView: FeedsWorkspaceMobileView,
    shouldPush?: boolean
  ) => void;
  setNetworkMessage: React.Dispatch<React.SetStateAction<string | null>>;
}

/**
 * Safely parse a JSON response body.
 */
async function parseResponseJson<T>(response: Response): Promise<T | null> {
  try {
    return (await response.json()) as T;
  } catch {
    return null;
  }
}

/**
 * Async workspace actions and inline feedback state.
 */
export function useFeedsWorkspaceActions({
  allArticles,
  isMobile,
  router,
  setLiveMessage,
  setFeeds,
  setSelectedScope,
  setMobileViewWithHistory,
  setNetworkMessage,
}: UseFeedsWorkspaceActionsOptions) {
  const [isAddFeedFormVisible, setIsAddFeedFormVisible] = useState(false);
  const [feedUrlInput, setFeedUrlInput] = useState("");

  const [isAddingFeed, setIsAddingFeed] = useState(false);
  const [isRefreshingFeeds, setIsRefreshingFeeds] = useState(false);
  const [deletingFeedId, setDeletingFeedId] = useState<string | null>(null);

  const [infoMessage, setInfoMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

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
              item.id === articleId ? { ...item, readAt: optimisticReadAt } : item
            ),
          };
        })
      );

      try {
        const response = await fetch("/api/feeds", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "item.markRead", itemId: articleId }),
        });

        if (!response.ok) {
          const body = await parseResponseJson<ApiErrorResponse>(response);
          setErrorMessage(body?.error || "Unable to persist read state.");
        }
      } catch {
        setErrorMessage("Could not connect to the server.");
      }
    },
    [allArticles, setFeeds]
  );

  const handleRefresh = useCallback(async () => {
    if (isRefreshingFeeds) {
      return;
    }

    if (!navigator.onLine) {
      setNetworkMessage("You appear to be offline. This action requires an internet connection.");
      return;
    }

    setIsRefreshingFeeds(true);
    setInfoMessage(null);
    setErrorMessage(null);

    try {
      const response = await fetch("/api/refresh", { method: "POST" });
      const body = await parseResponseJson<RefreshResponse & ApiErrorResponse>(response);

      if (!response.ok) {
        setErrorMessage(body?.error || "Could not refresh feeds.");
        setIsRefreshingFeeds(false);
        return;
      }

      const addedCount =
        body?.results?.reduce(
          (total, result) => total + (result.status === "success" ? result.newItemCount : 0),
          0
        ) || 0;

      const refreshMessage =
        addedCount > 0
          ? `Refresh complete. ${addedCount} new article${addedCount === 1 ? "" : "s"} added.`
          : "Refresh complete. No new articles this time.";

      setInfoMessage(refreshMessage);
      setLiveMessage(refreshMessage);
      setIsRefreshingFeeds(false);
      router.refresh();
    } catch {
      setErrorMessage(
        "Could not connect to the server. Previously loaded articles are still available."
      );
      setIsRefreshingFeeds(false);
    }
  }, [isRefreshingFeeds, router, setLiveMessage, setNetworkMessage]);

  const handleAddFeed = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();

      if (isAddingFeed) {
        return;
      }

      if (!navigator.onLine) {
        setNetworkMessage("You appear to be offline. This action requires an internet connection.");
        return;
      }

      const nextUrl = feedUrlInput.trim();
      if (!nextUrl) {
        setErrorMessage("Feed URL is required.");
        setInfoMessage(null);
        return;
      }

      setIsAddingFeed(true);
      setInfoMessage(null);
      setErrorMessage(null);

      try {
        const response = await fetch("/api/feeds", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "feed.create",
            url: nextUrl,
          }),
        });
        const body = await parseResponseJson<ApiErrorResponse & FeedCreateResponse>(response);

        if (!response.ok) {
          setErrorMessage(body?.error || "Could not add feed.");
          setIsAddingFeed(false);
          return;
        }

        if (body?.feed?.id) {
          const createdFeed = body.feed;
          setFeeds((previousFeeds) => {
            const exists = previousFeeds.some((feed) => feed.id === createdFeed.id);
            if (exists) {
              return previousFeeds;
            }

            const nextFeed: FeedViewModel = {
              id: createdFeed.id,
              title: createdFeed.title ?? null,
              description: createdFeed.description ?? null,
              url: createdFeed.url,
              lastFetchedAt: createdFeed.lastFetchedAt ?? null,
              lastFetchStatus: createdFeed.lastFetchStatus ?? null,
              lastFetchErrorCode: createdFeed.lastFetchErrorCode ?? null,
              lastFetchErrorMessage: createdFeed.lastFetchErrorMessage ?? null,
              lastFetchErrorAt: createdFeed.lastFetchErrorAt ?? null,
              createdAt: createdFeed.createdAt ?? new Date().toISOString(),
              items: [],
            };

            return [nextFeed, ...previousFeeds];
          });

          setSelectedScope({ type: "feed", feedId: body.feed.id });
          if (isMobile) {
            setMobileViewWithHistory("articles", true);
          }
        }

        setFeedUrlInput("");
        setIsAddFeedFormVisible(false);
        setInfoMessage(body?.message || "Feed added.");
        setIsAddingFeed(false);
        router.refresh();
      } catch {
        setErrorMessage("Could not connect to the server.");
        setIsAddingFeed(false);
      }
    },
    [
      feedUrlInput,
      isAddingFeed,
      isMobile,
      router,
      setFeeds,
      setMobileViewWithHistory,
      setNetworkMessage,
      setSelectedScope,
    ]
  );

  const handleDeleteFeed = useCallback(
    async (feedId: string, feedLabel: string) => {
      if (deletingFeedId) {
        return;
      }

      const confirmed = window.confirm(`Delete feed "${feedLabel}"?`);
      if (!confirmed) {
        return;
      }

      setDeletingFeedId(feedId);
      setInfoMessage(null);
      setErrorMessage(null);

      try {
        const response = await fetch(`/api/feeds/${feedId}`, {
          method: "DELETE",
        });

        const body = await parseResponseJson<ApiErrorResponse>(response);

        if (!response.ok) {
          setErrorMessage(body?.error || "Could not delete feed.");
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
      } catch {
        setErrorMessage("Could not connect to the server.");
        setDeletingFeedId(null);
      }
    },
    [deletingFeedId, router, setFeeds, setSelectedScope]
  );

  const clearStatusMessages = useCallback(() => {
    setInfoMessage(null);
    setErrorMessage(null);
  }, []);

  const showAddFeedForm = useCallback(() => {
    setIsAddFeedFormVisible(true);
  }, []);

  const cancelAddFeedForm = useCallback(() => {
    setIsAddFeedFormVisible(false);
  }, []);

  return {
    isAddFeedFormVisible,
    feedUrlInput,
    isAddingFeed,
    isRefreshingFeeds,
    deletingFeedId,
    infoMessage,
    errorMessage,
    setFeedUrlInput,
    showAddFeedForm,
    cancelAddFeedForm,
    clearStatusMessages,
    markArticleAsRead,
    handleRefresh,
    handleAddFeed,
    handleDeleteFeed,
  };
}
