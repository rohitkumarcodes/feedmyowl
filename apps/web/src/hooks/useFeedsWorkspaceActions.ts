"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import type {
  ArticleViewModel,
  FeedViewModel,
  FolderViewModel,
} from "@/components/feeds-types";
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
    customTitle?: string | null;
    description?: string | null;
    url: string;
    folderIds?: string[];
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

interface FeedRenameResponse {
  feed?: {
    id: string;
    title?: string | null;
    customTitle?: string | null;
    url?: string;
    updatedAt?: string;
  };
}

interface FeedFolderUpdateResponse {
  feed?: {
    id: string;
    folderIds?: string[];
  };
}

interface FolderCreateResponse {
  folder?: {
    id: string;
    name: string;
    createdAt?: string;
    updatedAt?: string;
  };
}

interface FolderRenameResponse {
  folder?: {
    id: string;
    name: string;
    createdAt?: string;
    updatedAt?: string;
  };
}

interface FolderDeleteResponse {
  success?: boolean;
  mode?: "remove_only" | "remove_and_unsubscribe_exclusive";
  totalFeeds?: number;
  exclusiveFeeds?: number;
  crossListedFeeds?: number;
  unsubscribedFeeds?: number;
}

interface UseFeedsWorkspaceActionsOptions {
  allArticles: ArticleViewModel[];
  folders: FolderViewModel[];
  isMobile: boolean;
  router: {
    refresh(): void;
  };
  setLiveMessage: React.Dispatch<React.SetStateAction<string>>;
  setFeeds: React.Dispatch<React.SetStateAction<FeedViewModel[]>>;
  setFolders: React.Dispatch<React.SetStateAction<FolderViewModel[]>>;
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
  folders,
  isMobile,
  router,
  setLiveMessage,
  setFeeds,
  setFolders,
  setSelectedScope,
  setMobileViewWithHistory,
  setNetworkMessage,
}: UseFeedsWorkspaceActionsOptions) {
  const [isAddFeedFormVisible, setIsAddFeedFormVisible] = useState(false);
  const [feedUrlInput, setFeedUrlInput] = useState("");
  const [addFeedFolderIds, setAddFeedFolderIds] = useState<string[]>([]);
  const [addFeedNewFolderNameInput, setAddFeedNewFolderNameInput] = useState("");

  const [isAddingFeed, setIsAddingFeed] = useState(false);
  const [isRefreshingFeeds, setIsRefreshingFeeds] = useState(false);
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [deletingFeedId, setDeletingFeedId] = useState<string | null>(null);
  const [renamingFeedId, setRenamingFeedId] = useState<string | null>(null);
  const [updatingFeedFoldersId, setUpdatingFeedFoldersId] = useState<string | null>(null);
  const [deletingFolderId, setDeletingFolderId] = useState<string | null>(null);
  const [renamingFolderId, setRenamingFolderId] = useState<string | null>(null);

  const [infoMessage, setInfoMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const validFolderIds = new Set(folders.map((folder) => folder.id));
    setAddFeedFolderIds((previous) =>
      previous.filter((folderId) => validFolderIds.has(folderId))
    );
  }, [folders]);

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

  const createFolder = useCallback(
    async (name: string): Promise<FolderViewModel | null> => {
      const trimmedName = name.trim();

      if (!trimmedName || isCreatingFolder) {
        return null;
      }

      setIsCreatingFolder(true);
      setInfoMessage(null);
      setErrorMessage(null);

      try {
        const response = await fetch("/api/folders", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: trimmedName }),
        });

        const body = await parseResponseJson<ApiErrorResponse & FolderCreateResponse>(response);
        if (!response.ok || !body?.folder?.id) {
          setErrorMessage(body?.error || "Could not create folder.");
          setIsCreatingFolder(false);
          return null;
        }

        const nextFolder: FolderViewModel = {
          id: body.folder.id,
          name: body.folder.name,
          createdAt: body.folder.createdAt ?? new Date().toISOString(),
          updatedAt: body.folder.updatedAt ?? new Date().toISOString(),
        };

        setFolders((previousFolders) => {
          const exists = previousFolders.some((folder) => folder.id === nextFolder.id);
          if (exists) {
            return previousFolders;
          }

          return [...previousFolders, nextFolder].sort((a, b) =>
            a.name.localeCompare(b.name)
          );
        });

        setInfoMessage("Folder created.");
        setIsCreatingFolder(false);
        router.refresh();
        return nextFolder;
      } catch {
        setErrorMessage("Could not connect to the server.");
        setIsCreatingFolder(false);
        return null;
      }
    },
    [isCreatingFolder, router, setFolders]
  );

  const createFolderFromAddFeed = useCallback(async () => {
    const created = await createFolder(addFeedNewFolderNameInput);
    if (!created) {
      return;
    }

    setAddFeedNewFolderNameInput("");
    setAddFeedFolderIds((previous) =>
      previous.includes(created.id) ? previous : [...previous, created.id]
    );
  }, [addFeedNewFolderNameInput, createFolder]);

  const createFolderFromSidebar = useCallback(
    async (name: string): Promise<boolean> => {
      const created = await createFolder(name);
      return Boolean(created);
    },
    [createFolder]
  );

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
            folderIds: addFeedFolderIds,
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
              customTitle: createdFeed.customTitle ?? null,
              description: createdFeed.description ?? null,
              url: createdFeed.url,
              folderIds: createdFeed.folderIds ?? [],
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
        setAddFeedFolderIds([]);
        setAddFeedNewFolderNameInput("");
        setIsAddFeedFormVisible(false);

        if (body?.duplicate) {
          setInfoMessage(body.message || "This feed is already in your library.");
        } else {
          const folderCount = body?.feed?.folderIds?.length ?? 0;
          const assignmentMessage =
            folderCount > 0
              ? `Added to ${folderCount} folder${folderCount === 1 ? "" : "s"}.`
              : "Added to Uncategorized.";
          const baseMessage = body?.message || "Feed added.";
          setInfoMessage(`${baseMessage} ${assignmentMessage}`);
        }

        setIsAddingFeed(false);
        router.refresh();
      } catch {
        setErrorMessage("Could not connect to the server.");
        setIsAddingFeed(false);
      }
    },
    [
      addFeedFolderIds,
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
    async (feedId: string) => {
      if (renamingFeedId || deletingFeedId || updatingFeedFoldersId) {
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
    [
      deletingFeedId,
      renamingFeedId,
      router,
      setFeeds,
      setSelectedScope,
      updatingFeedFoldersId,
    ]
  );

  const handleRenameFeed = useCallback(
    async (feedId: string, name: string): Promise<boolean> => {
      if (deletingFeedId || renamingFeedId || updatingFeedFoldersId) {
        return false;
      }

      setRenamingFeedId(feedId);
      setInfoMessage(null);
      setErrorMessage(null);

      try {
        const response = await fetch(`/api/feeds/${feedId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name }),
        });

        const body = await parseResponseJson<ApiErrorResponse & FeedRenameResponse>(response);

        if (!response.ok) {
          setErrorMessage(body?.error || "Could not update feed name.");
          setRenamingFeedId(null);
          return false;
        }

        const nextCustomTitle = body?.feed?.customTitle ?? null;
        setFeeds((previousFeeds) =>
          previousFeeds.map((feed) =>
            feed.id === feedId ? { ...feed, customTitle: nextCustomTitle } : feed
          )
        );

        setInfoMessage(name.trim() ? "Feed name updated." : "Feed name reset.");
        setRenamingFeedId(null);
        router.refresh();
        return true;
      } catch {
        setErrorMessage("Could not connect to the server.");
        setRenamingFeedId(null);
        return false;
      }
    },
    [deletingFeedId, renamingFeedId, router, setFeeds, updatingFeedFoldersId]
  );

  const handleSetFeedFolders = useCallback(
    async (feedId: string, folderIds: string[]): Promise<boolean> => {
      if (deletingFeedId || renamingFeedId || updatingFeedFoldersId) {
        return false;
      }

      setUpdatingFeedFoldersId(feedId);
      setInfoMessage(null);
      setErrorMessage(null);

      try {
        const response = await fetch(`/api/feeds/${feedId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "feed.setFolders",
            folderIds,
          }),
        });
        const body = await parseResponseJson<ApiErrorResponse & FeedFolderUpdateResponse>(response);

        if (!response.ok) {
          setErrorMessage(body?.error || "Could not update feed folders.");
          setUpdatingFeedFoldersId(null);
          return false;
        }

        const nextFolderIds = body?.feed?.folderIds ?? [];
        setFeeds((previousFeeds) =>
          previousFeeds.map((feed) =>
            feed.id === feedId ? { ...feed, folderIds: nextFolderIds } : feed
          )
        );

        setInfoMessage(
          nextFolderIds.length > 0
            ? `Feed assigned to ${nextFolderIds.length} folder${
                nextFolderIds.length === 1 ? "" : "s"
              }.`
            : "Feed moved to Uncategorized."
        );
        setUpdatingFeedFoldersId(null);
        router.refresh();
        return true;
      } catch {
        setErrorMessage("Could not connect to the server.");
        setUpdatingFeedFoldersId(null);
        return false;
      }
    },
    [deletingFeedId, renamingFeedId, router, setFeeds, updatingFeedFoldersId]
  );

  const handleRenameFolder = useCallback(
    async (folderId: string, name: string): Promise<boolean> => {
      if (deletingFolderId || renamingFolderId || isCreatingFolder) {
        return false;
      }

      setRenamingFolderId(folderId);
      setInfoMessage(null);
      setErrorMessage(null);

      try {
        const response = await fetch(`/api/folders/${folderId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name }),
        });
        const body = await parseResponseJson<ApiErrorResponse & FolderRenameResponse>(response);

        if (!response.ok || !body?.folder?.id) {
          setErrorMessage(body?.error || "Could not rename folder.");
          setRenamingFolderId(null);
          return false;
        }

        setFolders((previousFolders) =>
          previousFolders
            .map((folder) =>
              folder.id === folderId
                ? {
                    ...folder,
                    name: body.folder?.name ?? folder.name,
                    updatedAt: body.folder?.updatedAt ?? new Date().toISOString(),
                  }
                : folder
            )
            .sort((a, b) => a.name.localeCompare(b.name))
        );

        setInfoMessage("Folder name updated.");
        setRenamingFolderId(null);
        router.refresh();
        return true;
      } catch {
        setErrorMessage("Could not connect to the server.");
        setRenamingFolderId(null);
        return false;
      }
    },
    [deletingFolderId, isCreatingFolder, renamingFolderId, router, setFolders]
  );

  const handleDeleteFolder = useCallback(
    async (
      folderId: string,
      mode: "remove_only" | "remove_and_unsubscribe_exclusive"
    ): Promise<boolean> => {
      if (deletingFolderId || renamingFolderId || isCreatingFolder) {
        return false;
      }

      setDeletingFolderId(folderId);
      setInfoMessage(null);
      setErrorMessage(null);

      try {
        const response = await fetch(`/api/folders/${folderId}?mode=${mode}`, {
          method: "DELETE",
        });
        const body = await parseResponseJson<ApiErrorResponse & FolderDeleteResponse>(response);

        if (!response.ok) {
          setErrorMessage(body?.error || "Could not delete folder.");
          setDeletingFolderId(null);
          return false;
        }

        setFolders((previousFolders) =>
          previousFolders.filter((folder) => folder.id !== folderId)
        );

        if (mode === "remove_and_unsubscribe_exclusive") {
          setFeeds((previousFeeds) =>
            previousFeeds
              .filter((feed) => {
                if (!feed.folderIds.includes(folderId)) {
                  return true;
                }
                return feed.folderIds.length > 1;
              })
              .map((feed) =>
                feed.folderIds.includes(folderId)
                  ? {
                      ...feed,
                      folderIds: feed.folderIds.filter((candidate) => candidate !== folderId),
                    }
                  : feed
              )
          );
        } else {
          setFeeds((previousFeeds) =>
            previousFeeds.map((feed) => ({
              ...feed,
              folderIds: feed.folderIds.filter((candidate) => candidate !== folderId),
            }))
          );
        }

        setSelectedScope((previousScope) => {
          if (previousScope.type === "folder" && previousScope.folderId === folderId) {
            return { type: "all" };
          }
          return previousScope;
        });

        if (mode === "remove_and_unsubscribe_exclusive") {
          const unsubscribedCount = body?.unsubscribedFeeds ?? 0;
          setInfoMessage(
            `Folder deleted. Unsubscribed ${unsubscribedCount} exclusive feed${
              unsubscribedCount === 1 ? "" : "s"
            }.`
          );
        } else {
          setInfoMessage("Folder deleted. Feeds were moved to remaining folders or Uncategorized.");
        }

        setDeletingFolderId(null);
        router.refresh();
        return true;
      } catch {
        setErrorMessage("Could not connect to the server.");
        setDeletingFolderId(null);
        return false;
      }
    },
    [deletingFolderId, isCreatingFolder, renamingFolderId, router, setFeeds, setFolders, setSelectedScope]
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
    setAddFeedFolderIds([]);
    setAddFeedNewFolderNameInput("");
  }, []);

  const toggleAddFeedFolder = useCallback((folderId: string) => {
    setAddFeedFolderIds((previous) =>
      previous.includes(folderId)
        ? previous.filter((candidate) => candidate !== folderId)
        : [...previous, folderId]
    );
  }, []);

  return {
    isAddFeedFormVisible,
    feedUrlInput,
    addFeedFolderIds,
    addFeedNewFolderNameInput,
    isAddingFeed,
    isRefreshingFeeds,
    isCreatingFolder,
    deletingFeedId,
    renamingFeedId,
    updatingFeedFoldersId,
    deletingFolderId,
    renamingFolderId,
    infoMessage,
    errorMessage,
    setFeedUrlInput,
    toggleAddFeedFolder,
    setAddFeedNewFolderNameInput,
    createFolderFromAddFeed,
    createFolderFromSidebar,
    showAddFeedForm,
    cancelAddFeedForm,
    clearStatusMessages,
    markArticleAsRead,
    handleRefresh,
    handleAddFeed,
    handleRenameFeed,
    handleDeleteFeed,
    handleSetFeedFolders,
    handleRenameFolder,
    handleDeleteFolder,
  };
}
