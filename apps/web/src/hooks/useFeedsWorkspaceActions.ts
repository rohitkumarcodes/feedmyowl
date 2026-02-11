"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import type {
  ArticleViewModel,
  FeedViewModel,
  FolderViewModel,
} from "@/components/feeds-types";
import type { SidebarScope } from "@/components/Sidebar";
import type { FeedsWorkspaceMobileView } from "@/hooks/useFeedsWorkspaceMobile";
import {
  dedupeBulkFeedLines,
  parseBulkFeedLines,
  summarizeBulkAddRows,
} from "@/lib/add-feed-bulk";
import {
  createFeed as createFeedRequest,
  createFolder as createFolderRequest,
  deleteFeed as deleteFeedRequest,
  deleteFolder as deleteFolderRequest,
  discoverFeed as discoverFeedRequest,
  markItemRead as markItemReadRequest,
  refreshFeeds as refreshFeedsRequest,
  renameFeed as renameFeedRequest,
  renameFolder as renameFolderRequest,
  setFeedFolders as setFeedFoldersRequest,
} from "@/lib/client/feeds-api";
import { useFeedActionStatus } from "@/hooks/feeds/useFeedActionStatus";
import { normalizeFeedUrl } from "@/lib/feed-url";
import { OFFLINE_CACHED_ARTICLES_MESSAGE } from "@/lib/network-messages";

const INFO_MESSAGE_AUTO_CLEAR_MS = 8000;

export type AddFeedStage =
  | "normalizing"
  | "discovering"
  | "awaiting_selection"
  | "creating";

export interface DiscoveryCandidate {
  url: string;
  title: string | null;
  method: "direct" | "html_alternate" | "heuristic_path";
  duplicate: boolean;
  existingFeedId: string | null;
}

export interface FeedDiscoverResponse {
  status?: "single" | "multiple" | "duplicate";
  normalizedInputUrl?: string;
  candidates?: DiscoveryCandidate[];
}

export interface BulkAddResultRow {
  url: string;
  status: "imported" | "duplicate" | "failed";
  message?: string;
}

interface ApiErrorResponse {
  error?: string;
  code?: string;
  message?: string;
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

interface UseFeedsWorkspaceActionsOptions {
  allArticles: ArticleViewModel[];
  feeds: FeedViewModel[];
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
 * Async workspace actions and inline feedback state.
 */
export function useFeedsWorkspaceActions({
  allArticles,
  feeds,
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
  const [addFeedInputMode, setAddFeedInputMode] = useState<"single" | "bulk">(
    "single"
  );
  const [feedUrlInput, setFeedUrlInput] = useState("");
  const [bulkFeedUrlInput, setBulkFeedUrlInput] = useState("");
  const [addFeedFolderIds, setAddFeedFolderIds] = useState<string[]>([]);
  const [lastUsedAddFeedFolderIds, setLastUsedAddFeedFolderIds] = useState<string[]>(
    []
  );
  const [addFeedNewFolderNameInput, setAddFeedNewFolderNameInput] = useState("");
  const [addFeedStage, setAddFeedStage] = useState<AddFeedStage | null>(null);
  const [addFeedProgressMessage, setAddFeedProgressMessage] = useState<string | null>(
    null
  );
  const [discoveryCandidates, setDiscoveryCandidates] = useState<
    DiscoveryCandidate[]
  >([]);
  const [selectedDiscoveryCandidateUrl, setSelectedDiscoveryCandidateUrl] =
    useState("");
  const [bulkAddResultRows, setBulkAddResultRows] = useState<
    BulkAddResultRow[] | null
  >(null);

  const [isAddingFeed, setIsAddingFeed] = useState(false);
  const [isRefreshingFeeds, setIsRefreshingFeeds] = useState(false);
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [deletingFeedId, setDeletingFeedId] = useState<string | null>(null);
  const [renamingFeedId, setRenamingFeedId] = useState<string | null>(null);
  const [updatingFeedFoldersId, setUpdatingFeedFoldersId] = useState<string | null>(null);
  const [deletingFolderId, setDeletingFolderId] = useState<string | null>(null);
  const [renamingFolderId, setRenamingFolderId] = useState<string | null>(null);

  const {
    infoMessage,
    setInfoMessage,
    errorMessage,
    setErrorMessage,
    showAddAnotherAction,
    setShowAddAnotherAction,
    clearStatusMessages,
  } = useFeedActionStatus();

  useEffect(() => {
    if (!infoMessage || showAddAnotherAction) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setInfoMessage((currentMessage) =>
        currentMessage === infoMessage ? null : currentMessage
      );
    }, INFO_MESSAGE_AUTO_CLEAR_MS);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [infoMessage, setInfoMessage, showAddAnotherAction]);

  useEffect(() => {
    const validFolderIds = new Set(folders.map((folder) => folder.id));
    setAddFeedFolderIds((previous) =>
      previous.filter((folderId) => validFolderIds.has(folderId))
    );
  }, [folders]);

  const normalizedExistingFeedUrls = useMemo(() => {
    const normalizedUrls = new Set<string>();

    for (const feed of feeds) {
      const normalizedUrl = normalizeFeedUrl(feed.url);
      if (!normalizedUrl) {
        continue;
      }

      normalizedUrls.add(normalizedUrl);
    }

    return normalizedUrls;
  }, [feeds]);

  const normalizedSingleUrlInput = useMemo(
    () => normalizeFeedUrl(feedUrlInput),
    [feedUrlInput]
  );

  const isSingleInputDuplicate = Boolean(
    normalizedSingleUrlInput && normalizedExistingFeedUrls.has(normalizedSingleUrlInput)
  );

  useEffect(() => {
    setDiscoveryCandidates([]);
    setSelectedDiscoveryCandidateUrl("");
    setAddFeedStage((previous) =>
      previous === "awaiting_selection" ? null : previous
    );
    setAddFeedProgressMessage((previous) =>
      previous && addFeedInputMode === "single" ? null : previous
    );
  }, [feedUrlInput, addFeedInputMode]);

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

      const result = await markItemReadRequest(articleId);
      if (!result.ok) {
        if (result.networkError) {
          setErrorMessage("Could not connect to the server.");
          return;
        }

        setErrorMessage(result.body?.error || "Unable to persist read state.");
      }
    },
    [allArticles, setErrorMessage, setFeeds]
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
  }, [
    isRefreshingFeeds,
    router,
    setErrorMessage,
    setInfoMessage,
    setLiveMessage,
    setNetworkMessage,
    setShowAddAnotherAction,
  ]);

  const createFolder = useCallback(
    async (name: string): Promise<FolderViewModel | null> => {
      const trimmedName = name.trim();

      if (!trimmedName || isCreatingFolder) {
        return null;
      }

      setIsCreatingFolder(true);
      setInfoMessage(null);
      setErrorMessage(null);
      setShowAddAnotherAction(false);

      const result = await createFolderRequest(trimmedName);
      const body = result.body;
      if (!result.ok || !body?.folder?.id) {
        if (result.networkError) {
          setErrorMessage("Could not connect to the server.");
        } else {
          setErrorMessage(body?.error || "Could not create folder.");
        }
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
    },
    [
      isCreatingFolder,
      router,
      setErrorMessage,
      setFolders,
      setInfoMessage,
      setShowAddAnotherAction,
    ]
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

  const applyCreatedFeed = useCallback(
    (createdFeed: FeedCreateResponse["feed"]) => {
      if (!createdFeed?.id) {
        return;
      }

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

      setSelectedScope({ type: "feed", feedId: createdFeed.id });
      if (isMobile) {
        setMobileViewWithHistory("articles", true);
      }
    },
    [isMobile, setFeeds, setMobileViewWithHistory, setSelectedScope]
  );

  const handleAddFeed = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();

      if (isAddingFeed) {
        return;
      }

      if (!navigator.onLine) {
        setNetworkMessage(OFFLINE_CACHED_ARTICLES_MESSAGE);
        return;
      }

      const discoverFeed = async (
        url: string
      ): Promise<(ApiErrorResponse & FeedDiscoverResponse) | null> => {
        const result = await discoverFeedRequest(url);
        if (!result.ok) {
          if (result.networkError) {
            return { error: "Could not connect to the server." };
          }

          return {
            error: result.body?.error || "Could not discover feed URLs.",
            code: result.body?.code,
          };
        }

        return result.body;
      };

      const createFeed = async (
        url: string
      ): Promise<(ApiErrorResponse & FeedCreateResponse) | null> => {
        const result = await createFeedRequest(url, addFeedFolderIds);
        if (!result.ok) {
          if (result.networkError) {
            return { error: "Could not connect to the server." };
          }

          return {
            error: result.body?.error || "Could not add feed.",
            code: result.body?.code,
          };
        }

        return result.body;
      };

      setIsAddingFeed(true);
      setInfoMessage(null);
      setErrorMessage(null);
      setShowAddAnotherAction(false);
      setBulkAddResultRows(null);

      if (addFeedInputMode === "bulk") {
        const parsedLines = dedupeBulkFeedLines(parseBulkFeedLines(bulkFeedUrlInput));
        if (parsedLines.length === 0) {
          setErrorMessage("Paste at least one feed or site URL.");
          setIsAddingFeed(false);
          return;
        }

        const knownUrls = new Set(normalizedExistingFeedUrls);
        const rows: BulkAddResultRow[] = [];
        let hasStateChanges = false;

        for (let index = 0; index < parsedLines.length; index += 1) {
          const rawLine = parsedLines[index];
          setAddFeedStage("normalizing");
          setAddFeedProgressMessage(
            `Normalizing URL ${index + 1} of ${parsedLines.length}...`
          );

          const normalizedLine = normalizeFeedUrl(rawLine);
          if (!normalizedLine) {
            rows.push({
              url: rawLine,
              status: "failed",
              message: "This URL does not appear to be valid.",
            });
            continue;
          }

          if (knownUrls.has(normalizedLine)) {
            rows.push({
              url: normalizedLine,
              status: "duplicate",
              message: "This feed is already in your library.",
            });
            continue;
          }

          setAddFeedStage("discovering");
          setAddFeedProgressMessage(
            `Looking for feed URLs ${index + 1} of ${parsedLines.length}...`
          );
          const discoverBody = await discoverFeed(normalizedLine);
          if (!discoverBody) {
            rows.push({
              url: normalizedLine,
              status: "failed",
              message: "Could not discover feed URLs.",
            });
            continue;
          }

          if (discoverBody.error) {
            rows.push({
              url: normalizedLine,
              status: "failed",
              message: discoverBody.error,
            });
            continue;
          }

          const candidates = discoverBody.candidates ?? [];
          const addableCandidates = candidates.filter((candidate) => !candidate.duplicate);
          if (discoverBody.status === "multiple" || addableCandidates.length > 1) {
            rows.push({
              url: normalizedLine,
              status: "failed",
              message:
                "Multiple feeds found; add this URL individually to choose one.",
            });
            continue;
          }

          if (discoverBody.status === "duplicate" || addableCandidates.length === 0) {
            rows.push({
              url: normalizedLine,
              status: "duplicate",
              message: "This feed is already in your library.",
            });
            knownUrls.add(normalizedLine);
            continue;
          }

          setAddFeedStage("creating");
          setAddFeedProgressMessage(
            `Adding feed ${index + 1} of ${parsedLines.length}...`
          );
          const createBody = await createFeed(addableCandidates[0].url);
          if (!createBody) {
            rows.push({
              url: addableCandidates[0].url,
              status: "failed",
              message: "Could not add feed.",
            });
            continue;
          }

          if (createBody.error) {
            rows.push({
              url: addableCandidates[0].url,
              status: "failed",
              message: createBody.error,
            });
            continue;
          }

          if (createBody.duplicate) {
            rows.push({
              url: addableCandidates[0].url,
              status: "duplicate",
              message: createBody.message || "This feed is already in your library.",
            });
            knownUrls.add(addableCandidates[0].url);
            continue;
          }

          rows.push({
            url: addableCandidates[0].url,
            status: "imported",
          });
          knownUrls.add(addableCandidates[0].url);
          applyCreatedFeed(createBody.feed);
          hasStateChanges = true;
        }

        const summary = summarizeBulkAddRows(rows);
        setBulkAddResultRows(rows);
        setInfoMessage(
          `Processed ${summary.processedCount} URL${
            summary.processedCount === 1 ? "" : "s"
          }. Imported ${summary.importedCount}, skipped ${summary.duplicateCount} duplicate${
            summary.duplicateCount === 1 ? "" : "s"
          }, failed ${summary.failedCount}.`
        );
        setAddFeedStage(null);
        setAddFeedProgressMessage(null);
        setIsAddingFeed(false);

        if (hasStateChanges) {
          router.refresh();
        }
        return;
      }

      const typedUrl = feedUrlInput.trim();
      if (!typedUrl) {
        setErrorMessage("Feed URL is required.");
        setAddFeedStage(null);
        setAddFeedProgressMessage(null);
        setIsAddingFeed(false);
        return;
      }

      setAddFeedStage("normalizing");
      setAddFeedProgressMessage("Normalizing URL...");
      const normalizedSingleUrl = normalizeFeedUrl(typedUrl);
      if (!normalizedSingleUrl) {
        setErrorMessage("This URL does not appear to be valid.");
        setAddFeedStage(null);
        setAddFeedProgressMessage(null);
        setIsAddingFeed(false);
        return;
      }

      if (normalizedExistingFeedUrls.has(normalizedSingleUrl)) {
        setErrorMessage("This feed is already in your library.");
        setAddFeedStage(null);
        setAddFeedProgressMessage(null);
        setIsAddingFeed(false);
        return;
      }

      let candidateToCreateUrl: string | null = null;
      if (discoveryCandidates.length > 1) {
        if (!selectedDiscoveryCandidateUrl) {
          setErrorMessage("Select one discovered feed URL to continue.");
          setAddFeedStage("awaiting_selection");
          setAddFeedProgressMessage(
            "Multiple feeds found. Select one to continue."
          );
          setIsAddingFeed(false);
          return;
        }

        candidateToCreateUrl = selectedDiscoveryCandidateUrl;
      } else {
        setAddFeedStage("discovering");
        setAddFeedProgressMessage("Looking for feed URLs...");
        const discoverBody = await discoverFeed(normalizedSingleUrl);
        if (!discoverBody) {
          setErrorMessage("Could not discover feed URLs.");
          setAddFeedStage(null);
          setAddFeedProgressMessage(null);
          setIsAddingFeed(false);
          return;
        }

        if (discoverBody.error) {
          setErrorMessage(discoverBody.error);
          setAddFeedStage(null);
          setAddFeedProgressMessage(null);
          setIsAddingFeed(false);
          return;
        }

        const candidates = discoverBody.candidates ?? [];
        const addableCandidates = candidates.filter((candidate) => !candidate.duplicate);

        if (discoverBody.status === "duplicate" || addableCandidates.length === 0) {
          setInfoMessage("This feed is already in your library.");
          setAddFeedStage(null);
          setAddFeedProgressMessage(null);
          setIsAddingFeed(false);
          return;
        }

        if (discoverBody.status === "multiple" || addableCandidates.length > 1) {
          setDiscoveryCandidates(candidates);
          setSelectedDiscoveryCandidateUrl("");
          setAddFeedStage("awaiting_selection");
          setAddFeedProgressMessage(
            "Multiple feeds found. Select one to continue."
          );
          setIsAddingFeed(false);
          return;
        }

        candidateToCreateUrl = addableCandidates[0].url;
      }

      if (!candidateToCreateUrl) {
        setErrorMessage("Could not resolve a feed URL to add.");
        setAddFeedStage(null);
        setAddFeedProgressMessage(null);
        setIsAddingFeed(false);
        return;
      }

      setAddFeedStage("creating");
      setAddFeedProgressMessage("Adding selected feed...");
      const createBody = await createFeed(candidateToCreateUrl);
      if (!createBody) {
        setErrorMessage("Could not add feed.");
        setAddFeedStage(null);
        setAddFeedProgressMessage(null);
        setIsAddingFeed(false);
        return;
      }

      if (createBody.error) {
        setErrorMessage(createBody.error);
        setAddFeedStage(null);
        setAddFeedProgressMessage(null);
        setIsAddingFeed(false);
        return;
      }

      if (createBody.feed?.id) {
        applyCreatedFeed(createBody.feed);
      }

      setFeedUrlInput("");
      setBulkFeedUrlInput("");
      setAddFeedNewFolderNameInput("");
      setDiscoveryCandidates([]);
      setSelectedDiscoveryCandidateUrl("");
      setAddFeedStage(null);
      setAddFeedProgressMessage(null);
      setIsAddingFeed(false);

      if (createBody.duplicate) {
        setInfoMessage(createBody.message || "This feed is already in your library.");
        setAddFeedFolderIds([]);
        setIsAddFeedFormVisible(false);
        router.refresh();
        return;
      }

      const folderCount = createBody?.feed?.folderIds?.length ?? 0;
      const assignmentMessage =
        folderCount > 0
          ? `Added to ${folderCount} folder${folderCount === 1 ? "" : "s"}.`
          : "Added to Uncategorized.";
      const baseMessage = createBody?.message || "Feed added.";
      setInfoMessage(`${baseMessage} ${assignmentMessage}`);
      setShowAddAnotherAction(true);
      setLastUsedAddFeedFolderIds(addFeedFolderIds);
      setAddFeedFolderIds([]);
      setIsAddFeedFormVisible(false);
      router.refresh();
    },
    [
      addFeedInputMode,
      addFeedFolderIds,
      applyCreatedFeed,
      bulkFeedUrlInput,
      discoveryCandidates.length,
      feedUrlInput,
      isAddingFeed,
      normalizedExistingFeedUrls,
      router,
      setNetworkMessage,
      selectedDiscoveryCandidateUrl,
      setErrorMessage,
      setInfoMessage,
      setShowAddAnotherAction,
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
          feed.id === feedId ? { ...feed, customTitle: nextCustomTitle } : feed
        )
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
    ]
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
    ]
  );

  const handleRenameFolder = useCallback(
    async (folderId: string, name: string): Promise<boolean> => {
      if (deletingFolderId || renamingFolderId || isCreatingFolder) {
        return false;
      }

      setRenamingFolderId(folderId);
      setInfoMessage(null);
      setErrorMessage(null);
      setShowAddAnotherAction(false);

      const result = await renameFolderRequest(folderId, name);
      if (!result.ok || !result.body?.folder?.id) {
        if (result.networkError) {
          setErrorMessage("Could not connect to the server.");
        } else {
          setErrorMessage(result.body?.error || "Could not rename folder.");
        }
        setRenamingFolderId(null);
        return false;
      }

      setFolders((previousFolders) =>
        previousFolders
          .map((folder) =>
            folder.id === folderId
              ? {
                  ...folder,
                  name: result.body?.folder?.name ?? folder.name,
                  updatedAt: result.body?.folder?.updatedAt ?? new Date().toISOString(),
                }
              : folder
          )
          .sort((a, b) => a.name.localeCompare(b.name))
      );

      setInfoMessage("Folder name updated.");
      setRenamingFolderId(null);
      router.refresh();
      return true;
    },
    [
      deletingFolderId,
      isCreatingFolder,
      renamingFolderId,
      router,
      setErrorMessage,
      setFolders,
      setInfoMessage,
      setShowAddAnotherAction,
    ]
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
      setShowAddAnotherAction(false);

      const result = await deleteFolderRequest(folderId, mode);
      if (!result.ok) {
        if (result.networkError) {
          setErrorMessage("Could not connect to the server.");
        } else {
          setErrorMessage(result.body?.error || "Could not delete folder.");
        }
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
        const unsubscribedCount = result.body?.unsubscribedFeeds ?? 0;
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
    },
    [
      deletingFolderId,
      isCreatingFolder,
      renamingFolderId,
      router,
      setErrorMessage,
      setFeeds,
      setFolders,
      setInfoMessage,
      setSelectedScope,
      setShowAddAnotherAction,
    ]
  );

  const showAddFeedForm = useCallback(() => {
    clearStatusMessages();
    setIsAddFeedFormVisible(true);
    setAddFeedStage(null);
    setAddFeedProgressMessage(null);
  }, [clearStatusMessages]);

  const cancelAddFeedForm = useCallback(() => {
    setIsAddFeedFormVisible(false);
    setAddFeedInputMode("single");
    setFeedUrlInput("");
    setBulkFeedUrlInput("");
    setAddFeedFolderIds([]);
    setAddFeedNewFolderNameInput("");
    setDiscoveryCandidates([]);
    setSelectedDiscoveryCandidateUrl("");
    setBulkAddResultRows(null);
    setAddFeedStage(null);
    setAddFeedProgressMessage(null);
  }, []);

  const toggleAddFeedFolder = useCallback((folderId: string) => {
    setAddFeedFolderIds((previous) =>
      previous.includes(folderId)
        ? previous.filter((candidate) => candidate !== folderId)
        : [...previous, folderId]
    );
  }, []);

  const updateAddFeedInputMode = useCallback((mode: "single" | "bulk") => {
    setAddFeedInputMode(mode);
    setErrorMessage(null);
    setInfoMessage(null);
    setBulkAddResultRows(null);
    setDiscoveryCandidates([]);
    setSelectedDiscoveryCandidateUrl("");
    setAddFeedStage(null);
    setAddFeedProgressMessage(null);
  }, [setErrorMessage, setInfoMessage]);

  const handleAddAnother = useCallback(() => {
    setIsAddFeedFormVisible(true);
    setAddFeedInputMode("single");
    setFeedUrlInput("");
    setBulkFeedUrlInput("");
    setAddFeedFolderIds(lastUsedAddFeedFolderIds);
    setAddFeedNewFolderNameInput("");
    setDiscoveryCandidates([]);
    setSelectedDiscoveryCandidateUrl("");
    setBulkAddResultRows(null);
    setAddFeedStage(null);
    setAddFeedProgressMessage(null);
    setInfoMessage(null);
    setErrorMessage(null);
    setShowAddAnotherAction(false);
  }, [lastUsedAddFeedFolderIds, setErrorMessage, setInfoMessage, setShowAddAnotherAction]);

  const selectDiscoveryCandidate = useCallback((url: string) => {
    setSelectedDiscoveryCandidateUrl(url);
    setErrorMessage(null);
  }, [setErrorMessage]);

  const inlineDuplicateMessage =
    addFeedInputMode === "single" && isSingleInputDuplicate
      ? "This feed is already in your library."
      : null;

  const bulkAddSummary = useMemo(() => {
    if (!bulkAddResultRows) {
      return null;
    }

    return summarizeBulkAddRows(bulkAddResultRows);
  }, [bulkAddResultRows]);

  return {
    isAddFeedFormVisible,
    addFeedInputMode,
    addFeedStage,
    addFeedProgressMessage,
    feedUrlInput,
    bulkFeedUrlInput,
    inlineDuplicateMessage,
    addFeedFolderIds,
    addFeedNewFolderNameInput,
    discoveryCandidates,
    selectedDiscoveryCandidateUrl,
    bulkAddResultRows,
    bulkAddSummary,
    showAddAnotherAction,
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
    setAddFeedInputMode: updateAddFeedInputMode,
    setBulkFeedUrlInput,
    setFeedUrlInput,
    toggleAddFeedFolder,
    setAddFeedNewFolderNameInput,
    selectDiscoveryCandidate,
    createFolderFromAddFeed,
    createFolderFromSidebar,
    handleAddAnother,
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
