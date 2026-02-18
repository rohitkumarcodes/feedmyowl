"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import type { ApiErrorBody } from "@/contracts/api/common";
import type {
  FeedActionNoticeOptions,
  FeedActionNoticeSource,
} from "@/features/feeds/hooks/useFeedActionStatus";
import type { FeedViewModel, FolderViewModel } from "@/features/feeds/types/view-models";
import type { SidebarScope } from "@/features/feeds/types/scopes";
import type { FeedsWorkspaceMobileView } from "@/features/feeds/hooks/useFeedsWorkspaceMobile";
import {
  createFeed as createFeedRequest,
  discoverFeed as discoverFeedRequest,
} from "@/lib/client/feeds";
import { normalizeFeedUrl } from "@/lib/shared/feed-url";
import { OFFLINE_CACHED_ARTICLES_MESSAGE } from "@/lib/shared/network-messages";
import { mapApiCallResultToUiMessage } from "@/lib/shared/ui-messages";

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

interface ApiErrorResponse {
  error?: string;
  code?: string;
  hint?: string;
  retryAfterSeconds?: number;
}

interface AddFeedFlowFailure {
  status: number;
  error: string;
  code?: string;
  hint?: string;
  retryAfterSeconds?: number;
}

interface AddFeedFlowSuccess<TResponse> {
  ok: true;
  body: TResponse;
}

interface AddFeedFlowFailureResult {
  ok: false;
  failure: AddFeedFlowFailure;
}

type AddFeedFlowResult<TResponse> =
  | AddFeedFlowSuccess<TResponse>
  | AddFeedFlowFailureResult;

interface RetryableApiResult {
  status: number;
  networkError: boolean;
  body: Partial<ApiErrorBody> | null;
  headers: Headers | null;
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
  mergedFolderCount?: number;
  message?: string;
}

interface UseAddFeedFlowOptions {
  feeds: FeedViewModel[];
  folders: FolderViewModel[];
  isMobile: boolean;
  router: { refresh(): void };
  setFeeds: React.Dispatch<React.SetStateAction<FeedViewModel[]>>;
  setSelectedScope: React.Dispatch<React.SetStateAction<SidebarScope>>;
  setMobileViewWithHistory: (
    nextView: FeedsWorkspaceMobileView,
    shouldPush?: boolean,
  ) => void;
  setNetworkMessage: React.Dispatch<React.SetStateAction<string | null>>;
  clearStatusMessages: () => void;
  progressNotice: string | null;
  setProgressNotice: (message: string) => void;
  clearProgressNotice: () => void;
  setInfoMessage: (message: string | null, options?: FeedActionNoticeOptions) => void;
  setErrorMessage: (message: string | null, options?: FeedActionNoticeOptions) => void;
  setShowAddAnotherAction: React.Dispatch<React.SetStateAction<boolean>>;
  createFolder: (name: string) => Promise<FolderViewModel | null>;
  handleRenameFolder: (folderId: string, name: string) => Promise<boolean>;
}

export function useAddFeedFlow({
  feeds,
  folders,
  isMobile,
  router,
  setFeeds,
  setSelectedScope,
  setMobileViewWithHistory,
  setNetworkMessage,
  clearStatusMessages,
  progressNotice,
  setProgressNotice,
  clearProgressNotice,
  setInfoMessage,
  setErrorMessage,
  setShowAddAnotherAction,
  createFolder,
  handleRenameFolder,
}: UseAddFeedFlowOptions) {
  const [isAddFeedFormVisible, setIsAddFeedFormVisible] = useState(false);
  const [feedUrlInput, setFeedUrlInput] = useState("");
  const [addFeedFolderIds, setAddFeedFolderIds] = useState<string[]>([]);
  const [lastUsedAddFeedFolderIds, setLastUsedAddFeedFolderIds] = useState<string[]>([]);
  const [addFeedNewFolderNameInput, setAddFeedNewFolderNameInput] = useState("");
  const [createdFolderRenameId, setCreatedFolderRenameId] = useState<string | null>(null);
  const [addFeedStage, setAddFeedStage] = useState<AddFeedStage | null>(null);
  const [discoveryCandidates, setDiscoveryCandidates] = useState<DiscoveryCandidate[]>(
    [],
  );
  const [selectedDiscoveryCandidateUrl, setSelectedDiscoveryCandidateUrl] = useState("");
  const [addFeedFieldError, setAddFeedFieldError] = useState<string | null>(null);
  const [isAddingFeed, setIsAddingFeed] = useState(false);

  const pushFlowError = useCallback(
    (
      failure: AddFeedFlowFailure,
      options?: {
        source?: FeedActionNoticeSource;
        retryAction?: () => void;
      },
    ) => {
      setErrorMessage(failure.error, {
        severity: failure.status === 429 ? "warning" : "error",
        title: failure.status === 429 ? "Too many requests" : "Couldn't add feed",
        source: options?.source ?? "add_feed",
        dedupeKey: `feed.add:${failure.code ?? failure.status}`,
        retryAction:
          options?.retryAction && failure.status === 429
            ? {
                label: "Retry",
                onAction: options.retryAction,
              }
            : undefined,
      });
    },
    [setErrorMessage],
  );

  const mapAddFeedFailure = useCallback(
    (
      result: RetryableApiResult,
      fallbackMessage: string,
      fallbackCode: string,
    ): AddFeedFlowFailure => {
      const mapped = mapApiCallResultToUiMessage(result, "feed.add", fallbackMessage);

      return {
        status: result.status,
        error: mapped.text,
        code: result.body?.code || fallbackCode,
        hint: result.body?.hint,
        retryAfterSeconds: mapped.retryAfterSeconds,
      };
    },
    [],
  );

  useEffect(() => {
    const validFolderIds = new Set(folders.map((folder) => folder.id));
    setAddFeedFolderIds((previous) =>
      previous.filter((folderId) => validFolderIds.has(folderId)),
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

  const feedIdByNormalizedUrl = useMemo(() => {
    const map = new Map<string, string>();

    for (const feed of feeds) {
      const normalizedUrl = normalizeFeedUrl(feed.url);
      if (!normalizedUrl) {
        continue;
      }

      map.set(normalizedUrl, feed.id);
    }

    return map;
  }, [feeds]);

  const normalizedSingleUrlInput = useMemo(
    () => normalizeFeedUrl(feedUrlInput),
    [feedUrlInput],
  );

  const isSingleInputDuplicate = Boolean(
    normalizedSingleUrlInput && normalizedExistingFeedUrls.has(normalizedSingleUrlInput),
  );

  useEffect(() => {
    setDiscoveryCandidates([]);
    setSelectedDiscoveryCandidateUrl("");
    setAddFeedFieldError(null);
    setAddFeedStage((previous) => (previous === "awaiting_selection" ? null : previous));
    if (progressNotice) {
      clearProgressNotice();
    }
  }, [clearProgressNotice, feedUrlInput, progressNotice]);

  const createFolderFromAddFeed = useCallback(async () => {
    const created = await createFolder(addFeedNewFolderNameInput);
    if (!created) {
      return;
    }

    setAddFeedNewFolderNameInput("");
    setCreatedFolderRenameId(created.id);
    setAddFeedFolderIds((previous) =>
      previous.includes(created.id) ? previous : [...previous, created.id],
    );
  }, [addFeedNewFolderNameInput, createFolder]);

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
    [isMobile, setFeeds, setMobileViewWithHistory, setSelectedScope],
  );

  const applyUpdatedExistingFeed = useCallback(
    (existingFeed: FeedCreateResponse["feed"]) => {
      if (!existingFeed?.id) {
        return;
      }

      setFeeds((previousFeeds) =>
        previousFeeds.map((feed) =>
          feed.id === existingFeed.id
            ? {
                ...feed,
                folderIds: existingFeed.folderIds ?? feed.folderIds,
                customTitle: existingFeed.customTitle ?? feed.customTitle,
                title: existingFeed.title ?? feed.title,
                description: existingFeed.description ?? feed.description,
                lastFetchedAt: existingFeed.lastFetchedAt ?? feed.lastFetchedAt,
                lastFetchStatus: existingFeed.lastFetchStatus ?? feed.lastFetchStatus,
                lastFetchErrorCode:
                  existingFeed.lastFetchErrorCode ?? feed.lastFetchErrorCode,
                lastFetchErrorMessage:
                  existingFeed.lastFetchErrorMessage ?? feed.lastFetchErrorMessage,
                lastFetchErrorAt: existingFeed.lastFetchErrorAt ?? feed.lastFetchErrorAt,
              }
            : feed,
        ),
      );
    },
    [setFeeds],
  );

  const openExistingFeed = useCallback(
    (url: string) => {
      const normalizedUrl = normalizeFeedUrl(url);
      if (!normalizedUrl) {
        return;
      }

      const existingFeedId = feedIdByNormalizedUrl.get(normalizedUrl);
      if (!existingFeedId) {
        setErrorMessage(
          "We couldn't find this feed in your library. Try adding it again.",
          {
            title: "Feed not found",
            dedupeKey: "feed.add:open-existing-missing",
            source: "add_feed",
          },
        );
        return;
      }

      setSelectedScope({ type: "feed", feedId: existingFeedId });
      setIsAddFeedFormVisible(false);
      setShowAddAnotherAction(false);
      if (isMobile) {
        setMobileViewWithHistory("articles", true);
      }
    },
    [
      feedIdByNormalizedUrl,
      isMobile,
      setErrorMessage,
      setMobileViewWithHistory,
      setSelectedScope,
      setShowAddAnotherAction,
    ],
  );

  const discoverFeedForAdd = useCallback(
    async (
      url: string,
    ): Promise<AddFeedFlowResult<ApiErrorResponse & FeedDiscoverResponse>> => {
      const result = await discoverFeedRequest(url);
      if (!result.ok) {
        return {
          ok: false,
          failure: mapAddFeedFailure(
            result,
            "No feed found at this URL. Try the site's feed link.",
            "discover_failed",
          ),
        };
      }

      return {
        ok: true,
        body: result.body || {},
      };
    },
    [mapAddFeedFailure],
  );

  const createFeedForAdd = useCallback(
    async (
      url: string,
    ): Promise<AddFeedFlowResult<ApiErrorResponse & FeedCreateResponse>> => {
      const result = await createFeedRequest(url, addFeedFolderIds);
      if (!result.ok) {
        return {
          ok: false,
          failure: mapAddFeedFailure(
            result,
            "We couldn't add this feed right now. Try again.",
            "create_failed",
          ),
        };
      }

      return {
        ok: true,
        body: result.body || {},
      };
    },
    [addFeedFolderIds, mapAddFeedFailure],
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

      setIsAddingFeed(true);
      setInfoMessage(null);
      setErrorMessage(null);
      setAddFeedFieldError(null);
      setShowAddAnotherAction(false);

      try {
        const typedUrl = feedUrlInput.trim();
        if (!typedUrl) {
          setAddFeedFieldError("Enter a feed or site URL to continue.");
          setAddFeedStage(null);
          clearProgressNotice();
          setIsAddingFeed(false);
          return;
        }

        setAddFeedStage("normalizing");
        setProgressNotice("Normalizing URL...");
        const normalizedSingleUrl = normalizeFeedUrl(typedUrl);
        if (!normalizedSingleUrl) {
          setAddFeedFieldError("Enter a valid feed or site URL to continue.");
          setAddFeedStage(null);
          clearProgressNotice();
          setIsAddingFeed(false);
          return;
        }

        if (normalizedExistingFeedUrls.has(normalizedSingleUrl)) {
          setAddFeedFieldError("This feed is already in your library.");
          setAddFeedStage(null);
          clearProgressNotice();
          setIsAddingFeed(false);
          return;
        }

        let candidateToCreateUrl: string | null = null;
        if (discoveryCandidates.length > 1) {
          if (!selectedDiscoveryCandidateUrl) {
            setAddFeedFieldError("Choose one discovered feed URL to continue.");
            setAddFeedStage("awaiting_selection");
            setProgressNotice("Multiple feeds found. Select one to continue.");
            setIsAddingFeed(false);
            return;
          }

          candidateToCreateUrl = selectedDiscoveryCandidateUrl;
        } else {
          setAddFeedStage("discovering");
          setProgressNotice("Looking for feed URLs...");
          const discoverResult = await discoverFeedForAdd(normalizedSingleUrl);
          if (!discoverResult.ok) {
            pushFlowError(discoverResult.failure);
            setAddFeedStage(null);
            clearProgressNotice();
            setIsAddingFeed(false);
            return;
          }

          const discoverBody = discoverResult.body;
          if (discoverBody.error) {
            pushFlowError({
              status: 400,
              error: discoverBody.error,
              code: discoverBody.code,
            });
            setAddFeedStage(null);
            clearProgressNotice();
            setIsAddingFeed(false);
            return;
          }

          const candidates = discoverBody.candidates ?? [];
          const addableCandidates = candidates.filter(
            (candidate) => !candidate.duplicate,
          );

          if (discoverBody.status === "multiple" || addableCandidates.length > 1) {
            setDiscoveryCandidates(candidates);
            setSelectedDiscoveryCandidateUrl("");
            setAddFeedStage("awaiting_selection");
            setProgressNotice("Multiple feeds found. Select one to continue.");
            setIsAddingFeed(false);
            return;
          }

          candidateToCreateUrl =
            discoverBody.status === "duplicate" || addableCandidates.length === 0
              ? normalizedSingleUrl
              : addableCandidates[0].url;
        }

        if (!candidateToCreateUrl) {
          setAddFeedFieldError("No feed found at this URL. Try the site's feed link.");
          setAddFeedStage(null);
          clearProgressNotice();
          setIsAddingFeed(false);
          return;
        }

        setAddFeedStage("creating");
        setProgressNotice("Adding selected feed...");
        const createResult = await createFeedForAdd(candidateToCreateUrl);
        if (!createResult.ok) {
          pushFlowError(createResult.failure);
          setAddFeedStage(null);
          clearProgressNotice();
          setIsAddingFeed(false);
          return;
        }

        const createBody = createResult.body;
        if (createBody.error) {
          pushFlowError({
            status: 400,
            error: createBody.error,
            code: createBody.code,
          });
          setAddFeedStage(null);
          clearProgressNotice();
          setIsAddingFeed(false);
          return;
        }

        setFeedUrlInput("");
        setAddFeedNewFolderNameInput("");
        setDiscoveryCandidates([]);
        setSelectedDiscoveryCandidateUrl("");
        setAddFeedFieldError(null);
        setAddFeedStage(null);
        clearProgressNotice();
        setIsAddingFeed(false);

        if (createBody.duplicate) {
          applyUpdatedExistingFeed(createBody.feed);
          const mergedFolderCount = createBody.mergedFolderCount ?? 0;
          if (mergedFolderCount > 0) {
            setShowAddAnotherAction(true);
            setLastUsedAddFeedFolderIds(addFeedFolderIds);
          }
          setInfoMessage(createBody.message || "This feed is already in your library.", {
            source: "add_feed",
            title: "Feed already in library",
            dedupeKey: "feed.add:duplicate",
          });
          setAddFeedFolderIds([]);
          setIsAddFeedFormVisible(false);
          router.refresh();
          return;
        }

        if (createBody.feed?.id) {
          applyCreatedFeed(createBody.feed);
        }

        const folderCount = createBody?.feed?.folderIds?.length ?? 0;
        const assignmentMessage =
          folderCount > 0
            ? `Added to ${folderCount} folder${folderCount === 1 ? "" : "s"}.`
            : "Added to Uncategorized.";
        const baseMessage = createBody?.message || "Feed added.";
        setShowAddAnotherAction(true);
        setInfoMessage(`${baseMessage} ${assignmentMessage}`, {
          source: "add_feed",
          title: "Feed added",
          dedupeKey: "feed.add:success",
        });
        setLastUsedAddFeedFolderIds(addFeedFolderIds);
        setAddFeedFolderIds([]);
        setIsAddFeedFormVisible(false);
        router.refresh();
      } catch {
        pushFlowError({
          status: 500,
          error: "We couldn't add this feed right now. Try again.",
          code: "unexpected_failure",
        });
        setAddFeedStage(null);
        clearProgressNotice();
        setIsAddingFeed(false);
      }
    },
    [
      addFeedFolderIds,
      applyCreatedFeed,
      applyUpdatedExistingFeed,
      clearProgressNotice,
      createFeedForAdd,
      discoverFeedForAdd,
      discoveryCandidates.length,
      feedUrlInput,
      isAddingFeed,
      normalizedExistingFeedUrls,
      pushFlowError,
      router,
      selectedDiscoveryCandidateUrl,
      setErrorMessage,
      setInfoMessage,
      setAddFeedFieldError,
      setNetworkMessage,
      setProgressNotice,
      setShowAddAnotherAction,
    ],
  );

  const showAddFeedForm = useCallback(() => {
    clearStatusMessages();
    setIsAddFeedFormVisible(true);
    setAddFeedStage(null);
    setAddFeedFieldError(null);
    setCreatedFolderRenameId(null);
    clearProgressNotice();
  }, [clearProgressNotice, clearStatusMessages]);

  const cancelAddFeedForm = useCallback(() => {
    setIsAddFeedFormVisible(false);
    setFeedUrlInput("");
    setAddFeedFolderIds([]);
    setAddFeedNewFolderNameInput("");
    setDiscoveryCandidates([]);
    setSelectedDiscoveryCandidateUrl("");
    setAddFeedFieldError(null);
    setAddFeedStage(null);
    setCreatedFolderRenameId(null);
    clearProgressNotice();
  }, [clearProgressNotice]);

  const toggleAddFeedFolder = useCallback((folderId: string) => {
    setAddFeedFolderIds((previous) =>
      previous.includes(folderId)
        ? previous.filter((candidate) => candidate !== folderId)
        : [...previous, folderId],
    );
  }, []);

  const handleAddAnother = useCallback(() => {
    setIsAddFeedFormVisible(true);
    setFeedUrlInput("");
    setAddFeedFolderIds(lastUsedAddFeedFolderIds);
    setAddFeedNewFolderNameInput("");
    setDiscoveryCandidates([]);
    setSelectedDiscoveryCandidateUrl("");
    setAddFeedFieldError(null);
    setAddFeedStage(null);
    clearProgressNotice();
    setInfoMessage(null);
    setErrorMessage(null);
    setShowAddAnotherAction(false);
    setCreatedFolderRenameId(null);
  }, [
    clearProgressNotice,
    lastUsedAddFeedFolderIds,
    setErrorMessage,
    setInfoMessage,
    setShowAddAnotherAction,
  ]);

  const renameFolderFromAddFeed = useCallback(
    async (folderId: string, name: string): Promise<boolean> => {
      const renamed = await handleRenameFolder(folderId, name);
      if (renamed) {
        setCreatedFolderRenameId(null);
      }
      return renamed;
    },
    [handleRenameFolder],
  );

  const dismissCreatedFolderRename = useCallback(() => {
    setCreatedFolderRenameId(null);
  }, []);

  const selectDiscoveryCandidate = useCallback(
    (url: string) => {
      setSelectedDiscoveryCandidateUrl(url);
      setAddFeedFieldError(null);
      setErrorMessage(null);
    },
    [setErrorMessage],
  );

  const inlineDuplicateMessage = isSingleInputDuplicate
    ? "This feed is already in your library."
    : null;

  return {
    isAddFeedFormVisible,
    addFeedStage,
    feedUrlInput,
    addFeedFieldError,
    inlineDuplicateMessage,
    addFeedFolderIds,
    addFeedNewFolderNameInput,
    createdFolderRenameId,
    discoveryCandidates,
    selectedDiscoveryCandidateUrl,
    isAddingFeed,
    setFeedUrlInput,
    setAddFeedFolderIds,
    setAddFeedNewFolderNameInput,
    toggleAddFeedFolder,
    selectDiscoveryCandidate,
    createFolderFromAddFeed,
    renameFolderFromAddFeed,
    dismissCreatedFolderRename,
    openExistingFeed,
    showAddFeedForm,
    cancelAddFeedForm,
    handleAddAnother,
    handleAddFeed,
  };
}
