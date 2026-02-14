"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArticleList } from "./ArticleList";
import { ArticleReader } from "./ArticleReader";
import { KeyboardShortcutsModal } from "./KeyboardShortcutsModal";
import { Layout } from "./Layout";
import { Sidebar, SidebarScope } from "./Sidebar";
import { resolveVimArticleNavigation } from "./article-keyboard-navigation";
import {
  scrollReaderByLine,
  scrollReaderByPage,
} from "./article-reader-scroll";
import {
  advancePaneFocusCycle,
  type PaneCyclePhase,
} from "./pane-focus-cycle";
import {
  buildArticleSearchResults,
  type ArticleSearchHighlights,
} from "./article-search";
import {
  appendPageItemsToFeeds,
  createUninitializedScopePaginationState,
  getScopePaginationState,
  mergeServerFeedsWithLoadedItems,
  resetPaginationForServerRefresh,
  setScopePaginationError,
  setScopePaginationLoading,
  setScopePaginationSuccess,
  type PaginationByScopeKey,
} from "./article-pagination-state";
import { buildSidebarNotices } from "./sidebar-messages";
import type { FeedViewModel, FolderViewModel } from "./feeds-types";
import {
  doesArticleMatchSidebarScope,
  selectAllArticles,
  selectEmptyStateMessage,
  selectListStatusMessage,
  selectOpenArticle,
  selectScopeLabel,
  selectVisibleArticles,
} from "./feeds-workspace.selectors";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";
import { useFeedsWorkspaceActions } from "@/hooks/useFeedsWorkspaceActions";
import { useFeedsWorkspaceMobile } from "@/hooks/useFeedsWorkspaceMobile";
import { useFeedsWorkspaceNetwork } from "@/hooks/useFeedsWorkspaceNetwork";
import {
  DEFAULT_ARTICLE_PAGE_LIMIT,
  scopeToKey,
  type ArticlePageResponseBody,
  type ArticleScope,
} from "@/lib/article-pagination";
import { OFFLINE_CACHED_ARTICLES_MESSAGE } from "@/lib/network-messages";
import { OPEN_SHORTCUTS_DIALOG_EVENT } from "@/lib/shortcuts-dialog-events";
import styles from "./feeds-workspace.module.css";

interface FeedsWorkspaceProps {
  initialFeeds: FeedViewModel[];
  initialFolders: FolderViewModel[];
  initialPaginationByScopeKey: PaginationByScopeKey;
}

interface ApiErrorResponse {
  error?: string;
}

async function parseResponseJson<T>(response: Response): Promise<T | null> {
  try {
    return (await response.json()) as T;
  } catch {
    return null;
  }
}

function toArticleScope(scope: SidebarScope): ArticleScope | null {
  if (scope.type === "all") {
    return { type: "all" };
  }

  if (scope.type === "uncategorized") {
    return { type: "uncategorized" };
  }

  if (scope.type === "folder") {
    return { type: "folder", id: scope.folderId };
  }

  if (scope.type === "feed") {
    return { type: "feed", id: scope.feedId };
  }

  return null;
}

/**
 * Client orchestrator for feed subscriptions, article list state, and reader state.
 */
export function FeedsWorkspace({
  initialFeeds,
  initialFolders,
  initialPaginationByScopeKey,
}: FeedsWorkspaceProps) {
  const router = useRouter();

  const [feeds, setFeeds] = useState<FeedViewModel[]>(initialFeeds);
  const [folders, setFolders] = useState<FolderViewModel[]>(initialFolders);
  const [paginationByScopeKey, setPaginationByScopeKey] = useState<PaginationByScopeKey>(
    initialPaginationByScopeKey
  );
  const [selectedScope, setSelectedScope] = useState<SidebarScope>({ type: "none" });
  const [selectedArticleId, setSelectedArticleId] = useState<string | null>(null);
  const [openArticleId, setOpenArticleId] = useState<string | null>(null);
  const [liveMessage, setLiveMessage] = useState("");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [listCollapsed, setListCollapsed] = useState(false);
  const [, setPaneCyclePhase] = useState<PaneCyclePhase>(0);
  const [isShortcutsModalOpen, setIsShortcutsModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const sidebarCollapsedRef = useRef(sidebarCollapsed);
  const listCollapsedRef = useRef(listCollapsed);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const prefersReducedMotion = usePrefersReducedMotion();

  useEffect(() => {
    setFeeds((previousFeeds) =>
      mergeServerFeedsWithLoadedItems(previousFeeds, initialFeeds)
    );
  }, [initialFeeds]);

  useEffect(() => {
    const allScopeKey = scopeToKey({ type: "all" });
    const initialAllScope = initialPaginationByScopeKey[allScopeKey] ?? {
      initialized: true,
      isLoading: false,
      error: null,
      nextCursor: null,
      hasMore: false,
    };

    setPaginationByScopeKey((previous) =>
      resetPaginationForServerRefresh(previous, {
        allScopeKey,
        nextCursor: initialAllScope.nextCursor,
        hasMore: initialAllScope.hasMore,
      })
    );
  }, [initialPaginationByScopeKey]);

  useEffect(() => {
    setFolders(initialFolders);
  }, [initialFolders]);

  /* Sync collapsed states to data attributes on <html> so the
     fixed-position brand logo (rendered in the server-side auth layout)
     can be hidden via a pure CSS selector. */
  useEffect(() => {
    sidebarCollapsedRef.current = sidebarCollapsed;
    document.documentElement.setAttribute(
      "data-sidebar-collapsed",
      String(sidebarCollapsed)
    );
  }, [sidebarCollapsed]);

  useEffect(() => {
    listCollapsedRef.current = listCollapsed;
    document.documentElement.setAttribute(
      "data-list-collapsed",
      String(listCollapsed)
    );
  }, [listCollapsed]);

  const {
    isMobile,
    mobileView,
    setMobileViewWithHistory,
    onMobileBackToFeeds,
    onMobileBackToArticles,
  } = useFeedsWorkspaceMobile();

  const { networkMessage, setNetworkMessage } = useFeedsWorkspaceNetwork({
    feeds,
    folders,
    setFeeds,
    setFolders,
  });

  const allArticles = useMemo(() => selectAllArticles(feeds), [feeds]);

  const scopedArticles = useMemo(
    () => selectVisibleArticles(allArticles, selectedScope),
    [allArticles, selectedScope]
  );

  const searchResults = useMemo(
    () =>
      buildArticleSearchResults(allArticles, searchQuery, {
        minQueryLength: 2,
        maxResults: 50,
      }),
    [allArticles, searchQuery]
  );

  const isSearchActive = searchResults.isActive;

  const visibleArticles = useMemo(
    () =>
      isSearchActive
        ? searchResults.results.map((result) => result.article)
        : scopedArticles,
    [isSearchActive, scopedArticles, searchResults.results]
  );

  const searchHighlightsByArticleId = useMemo(() => {
    if (!isSearchActive) {
      return {};
    }

    const highlights: Record<string, ArticleSearchHighlights> = {};
    for (const result of searchResults.results) {
      highlights[result.article.id] = result.highlights;
    }
    return highlights;
  }, [isSearchActive, searchResults.results]);

  const openArticle = useMemo(
    () => selectOpenArticle(allArticles, openArticleId),
    [allArticles, openArticleId]
  );

  const selectedScopeLabel = useMemo(
    () => selectScopeLabel(feeds, folders, selectedScope),
    [feeds, folders, selectedScope]
  );

  const listStatusMessage = useMemo(
    () => selectListStatusMessage(feeds, selectedScope),
    [feeds, selectedScope]
  );

  const emptyStateMessage = useMemo(
    () => selectEmptyStateMessage(feeds.length, selectedScope),
    [feeds.length, selectedScope]
  );

  const selectedArticleScope = useMemo(
    () => toArticleScope(selectedScope),
    [selectedScope]
  );

  const selectedScopePagination = useMemo(() => {
    if (!selectedArticleScope) {
      return createUninitializedScopePaginationState();
    }

    return getScopePaginationState(
      paginationByScopeKey,
      scopeToKey(selectedArticleScope)
    );
  }, [paginationByScopeKey, selectedArticleScope]);

  const {
    isAddFeedFormVisible,
    addFeedStage,
    addFeedProgressMessage,
    feedUrlInput,
    inlineDuplicateMessage,
    addFeedFolderIds,
    addFeedNewFolderNameInput,
    createdFolderRenameId,
    discoveryCandidates,
    selectedDiscoveryCandidateUrl,
    showAddAnotherAction,
    isAddingFeed,
    isRefreshingFeeds,
    isCreatingFolder,
    deletingFeedId,
    renamingFeedId,
    updatingFeedFoldersId,
    deletingFolderId,
    renamingFolderId,
    isDeletingUncategorized,
    isMovingUncategorized,
    queuedNotices,
    setFeedUrlInput,
    setAddFeedFolderIds,
    toggleAddFeedFolder,
    setAddFeedNewFolderNameInput,
    selectDiscoveryCandidate,
    createFolderFromAddFeed,
    renameFolderFromAddFeed,
    dismissCreatedFolderRename,
    createFolderFromSidebar,
    handleAddAnother,
    openExistingFeed,
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
    handleDeleteUncategorizedFeeds,
    handleMoveUncategorizedFeeds,
    dismissNotice,
  } = useFeedsWorkspaceActions({
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
  });

  useEffect(() => {
    if (selectedScope.type === "feed") {
      const stillExists = feeds.some((feed) => feed.id === selectedScope.feedId);
      if (!stillExists) {
        setSelectedScope({ type: "all" });
      }
      return;
    }

    if (selectedScope.type === "uncategorized") {
      const hasUncategorizedFeeds = feeds.some((feed) => feed.folderIds.length === 0);
      if (!hasUncategorizedFeeds) {
        setSelectedScope({ type: "all" });
      }
      return;
    }

    if (selectedScope.type === "folder") {
      const stillExists = folders.some((folder) => folder.id === selectedScope.folderId);
      if (!stillExists) {
        setSelectedScope({ type: "all" });
      }
    }
  }, [feeds, folders, selectedScope]);

  useEffect(() => {
    if (!selectedArticleId) {
      if (visibleArticles.length > 0) {
        setSelectedArticleId(visibleArticles[0].id);
      }
      return;
    }

    const stillVisible = visibleArticles.some((article) => article.id === selectedArticleId);
    if (!stillVisible) {
      setSelectedArticleId(visibleArticles[0]?.id ?? null);
    }
  }, [selectedArticleId, visibleArticles]);

  /* Scroll the selected article row into view when navigating with j/k keys. */
  useEffect(() => {
    if (!selectedArticleId) {
      return;
    }

    const element = document.querySelector(`[data-article-id="${selectedArticleId}"]`);

    if (element) {
      element.scrollIntoView({ block: "nearest" });
    }
  }, [selectedArticleId]);

  useEffect(() => {
    if (!openArticleId) {
      return;
    }

    const exists = allArticles.some((article) => article.id === openArticleId);
    if (!exists) {
      setOpenArticleId(null);
    }
  }, [allArticles, openArticleId]);

  const focusArticleList = useCallback(() => {
    window.setTimeout(() => {
      const listRoot = document.querySelector<HTMLElement>("[data-article-list-root]");
      listRoot?.focus();
    }, 0);
  }, []);

  const focusReaderTitle = useCallback(() => {
    window.setTimeout(() => {
      const title = document.getElementById("reader-article-title");
      if (title instanceof HTMLElement) {
        title.focus();
      }
    }, 0);
  }, []);

  const isListContextTarget = useCallback((target: EventTarget | null): boolean => {
    const listRoot = document.querySelector<HTMLElement>("[data-article-list-root]");
    if (!listRoot) {
      return false;
    }

    if (target instanceof Node && listRoot.contains(target)) {
      return true;
    }

    const activeElement = document.activeElement;
    return activeElement instanceof Node ? listRoot.contains(activeElement) : false;
  }, []);

  const isReaderContextTarget = useCallback((target: EventTarget | null): boolean => {
    const readerRoot = document.querySelector<HTMLElement>("[data-article-reader-root]");
    if (!readerRoot) {
      return false;
    }

    if (target instanceof Node && readerRoot.contains(target)) {
      return true;
    }

    const activeElement = document.activeElement;
    return activeElement instanceof Node ? readerRoot.contains(activeElement) : false;
  }, []);

  const openShortcutsModal = useCallback(() => {
    setIsShortcutsModalOpen(true);
  }, []);

  const closeShortcutsModal = useCallback(() => {
    setIsShortcutsModalOpen(false);
  }, []);

  useEffect(() => {
    const handleOpenShortcutsDialog = () => {
      openShortcutsModal();
    };

    window.addEventListener(OPEN_SHORTCUTS_DIALOG_EVENT, handleOpenShortcutsDialog);

    return () => {
      window.removeEventListener(
        OPEN_SHORTCUTS_DIALOG_EVENT,
        handleOpenShortcutsDialog
      );
    };
  }, [openShortcutsModal]);

  const focusSearchInput = useCallback(() => {
    const input = searchInputRef.current;
    if (!input) {
      return;
    }

    input.focus();
    input.select();
  }, []);

  const scrollReaderByKeyboardLine = useCallback((direction: 1 | -1): boolean => {
    const readerRoot = document.querySelector<HTMLElement>("[data-article-reader-root]");
    if (!readerRoot) {
      return false;
    }

    return scrollReaderByLine(readerRoot, direction, "auto");
  }, []);

  const scrollReaderByKeyboardPage = useCallback(
    (direction: 1 | -1): boolean => {
      const readerRoot = document.querySelector<HTMLElement>("[data-article-reader-root]");
      if (!readerRoot) {
        return false;
      }

      const behavior: ScrollBehavior = prefersReducedMotion ? "auto" : "smooth";
      return scrollReaderByPage(readerRoot, direction, behavior);
    },
    [prefersReducedMotion]
  );

  const handleSidebarCollapse = useCallback(() => {
    setSidebarCollapsed(true);
    sidebarCollapsedRef.current = true;
    setPaneCyclePhase(0);
  }, []);

  const handleToggleSidebar = useCallback(() => {
    setSidebarCollapsed((previous) => {
      const next = !previous;
      sidebarCollapsedRef.current = next;
      return next;
    });
    setPaneCyclePhase(0);
  }, []);

  const handleCollapseList = useCallback(() => {
    setListCollapsed(true);
    listCollapsedRef.current = true;
    setPaneCyclePhase(0);
  }, []);

  const handleToggleList = useCallback(() => {
    setListCollapsed((previous) => {
      const next = !previous;
      listCollapsedRef.current = next;
      return next;
    });
    setPaneCyclePhase(0);
  }, []);

  const handleCycleFocusPanes = useCallback(() => {
    setPaneCyclePhase((currentPhase) => {
      const result = advancePaneFocusCycle(
        {
          sidebarCollapsed: sidebarCollapsedRef.current,
          listCollapsed: listCollapsedRef.current,
        },
        currentPhase
      );

      setSidebarCollapsed(result.nextPaneState.sidebarCollapsed);
      setListCollapsed(result.nextPaneState.listCollapsed);
      sidebarCollapsedRef.current = result.nextPaneState.sidebarCollapsed;
      listCollapsedRef.current = result.nextPaneState.listCollapsed;

      return result.nextPhase;
    });
  }, []);

  useEffect(() => {
    if (!isMobile) {
      return;
    }

    setIsShortcutsModalOpen(false);
  }, [isMobile]);

  const openSelectedArticle = useCallback(
    async (articleId: string) => {
      setSelectedArticleId(articleId);
      setOpenArticleId(articleId);
      focusReaderTitle();
      clearStatusMessages();
      await markArticleAsRead(articleId);

      if (isMobile) {
        setMobileViewWithHistory("reader", true);
      }
    },
    [
      clearStatusMessages,
      focusReaderTitle,
      isMobile,
      markArticleAsRead,
      setMobileViewWithHistory,
    ]
  );

  const loadNextPage = useCallback(
    async (scope: ArticleScope) => {
      const scopeKey = scopeToKey(scope);
      const currentScopePagination = getScopePaginationState(
        paginationByScopeKey,
        scopeKey
      );

      if (
        currentScopePagination.isLoading ||
        (currentScopePagination.initialized && !currentScopePagination.hasMore)
      ) {
        return;
      }

      if (!navigator.onLine) {
        setNetworkMessage(OFFLINE_CACHED_ARTICLES_MESSAGE);
        return;
      }

      setPaginationByScopeKey((previous) =>
        setScopePaginationLoading(previous, scopeKey)
      );

      const searchParams = new URLSearchParams({
        scopeType: scope.type,
        limit: String(DEFAULT_ARTICLE_PAGE_LIMIT),
      });

      if (scope.type === "feed" || scope.type === "folder") {
        searchParams.set("scopeId", scope.id);
      }

      if (currentScopePagination.nextCursor) {
        searchParams.set("cursor", currentScopePagination.nextCursor);
      }

      try {
        const response = await fetch(`/api/articles?${searchParams.toString()}`);
        const body = await parseResponseJson<ArticlePageResponseBody & ApiErrorResponse>(
          response
        );

        if (!response.ok || !body) {
          setPaginationByScopeKey((previous) =>
            setScopePaginationError(
              previous,
              scopeKey,
              body?.error || "Could not load more articles."
            )
          );
          return;
        }

        setFeeds((previousFeeds) =>
          appendPageItemsToFeeds(previousFeeds, body.items)
        );
        setPaginationByScopeKey((previous) =>
          setScopePaginationSuccess(previous, scopeKey, {
            nextCursor: body.nextCursor,
            hasMore: body.hasMore,
          })
        );
      } catch {
        setPaginationByScopeKey((previous) =>
          setScopePaginationError(previous, scopeKey, "Could not load more articles.")
        );
      }
    },
    [paginationByScopeKey, setNetworkMessage]
  );

  useEffect(() => {
    if (!selectedArticleScope || isSearchActive) {
      return;
    }

    const scopeKey = scopeToKey(selectedArticleScope);
    const scopePagination = getScopePaginationState(paginationByScopeKey, scopeKey);
    if (scopePagination.initialized || scopePagination.isLoading || scopePagination.error) {
      return;
    }

    void loadNextPage(selectedArticleScope);
  }, [
    isSearchActive,
    loadNextPage,
    paginationByScopeKey,
    selectedArticleScope,
  ]);

  const moveSelectionByArrow = useCallback(
    (step: 1 | -1) => {
      if (visibleArticles.length === 0) {
        setSelectedArticleId(null);
        return;
      }

      const index = visibleArticles.findIndex((article) => article.id === selectedArticleId);

      if (index < 0) {
        setSelectedArticleId(visibleArticles[0].id);
        return;
      }

      const nextIndex = Math.max(0, Math.min(visibleArticles.length - 1, index + step));
      setSelectedArticleId(visibleArticles[nextIndex].id);
    },
    [selectedArticleId, visibleArticles]
  );

  const navigateAndOpenByVim = useCallback(
    (step: 1 | -1) => {
      const result = resolveVimArticleNavigation({
        step,
        selectedScope,
        searchIsActive: isSearchActive,
        feeds,
        folders,
        allArticles,
        visibleArticles,
        selectedArticleId,
        openArticleId,
      });

      if (!result.didMove || !result.targetArticleId) {
        return;
      }

      if (
        result.targetScope &&
        (selectedScope.type !== "feed" ||
          selectedScope.feedId !== result.targetScope.feedId)
      ) {
        setSelectedScope(result.targetScope);
      }

      void openSelectedArticle(result.targetArticleId);
    },
    [
      allArticles,
      feeds,
      folders,
      isSearchActive,
      openArticleId,
      openSelectedArticle,
      selectedArticleId,
      selectedScope,
      visibleArticles,
    ]
  );

  const handleSelectScope = useCallback(
    (nextScope: SidebarScope) => {
      const wasSearchActive = isSearchActive;
      const openArticle = selectOpenArticle(allArticles, openArticleId);

      setSelectedScope(nextScope);

      if (wasSearchActive) {
        setSearchQuery("");

        if (!openArticle || !doesArticleMatchSidebarScope(openArticle, nextScope)) {
          setOpenArticleId(null);
        }
      } else {
        setOpenArticleId(null);
      }

      focusArticleList();

      if (isMobile) {
        setMobileViewWithHistory("articles", true);
      }
    },
    [
      allArticles,
      focusArticleList,
      isMobile,
      isSearchActive,
      openArticleId,
      setMobileViewWithHistory,
      setSearchQuery,
    ]
  );

  const sidebarNotices = useMemo(
    () =>
      buildSidebarNotices({
        progressMessage: addFeedProgressMessage,
        networkMessage,
        queuedNotices,
        showAddAnotherAction,
        onAddAnother: handleAddAnother,
      }),
    [
      addFeedProgressMessage,
      handleAddAnother,
      networkMessage,
      queuedNotices,
      showAddAnotherAction,
    ]
  );

  useKeyboardShortcuts({
    enabled: !isMobile,
    isShortcutsModalOpen,
    isListContextTarget,
    isReaderContextTarget,
    onNextArticleVim: () => navigateAndOpenByVim(1),
    onPreviousArticleVim: () => navigateAndOpenByVim(-1),
    onNextArticleArrow: () => moveSelectionByArrow(1),
    onPreviousArticleArrow: () => moveSelectionByArrow(-1),
    onReaderScrollLineDown: () => scrollReaderByKeyboardLine(1),
    onReaderScrollLineUp: () => scrollReaderByKeyboardLine(-1),
    onReaderScrollPageDown: () => scrollReaderByKeyboardPage(1),
    onReaderScrollPageUp: () => scrollReaderByKeyboardPage(-1),
    onOpenArticle: () => {
      if (selectedArticleId) {
        void openSelectedArticle(selectedArticleId);
      }
    },
    onRefreshFeeds: () => {
      void handleRefresh();
    },
    onCycleFocusPanes: handleCycleFocusPanes,
    onFocusSearch: focusSearchInput,
    onOpenShortcuts: openShortcutsModal,
    onCloseShortcuts: closeShortcutsModal,
  });

  useEffect(() => {
    if (isSearchActive) {
      if (searchResults.totalMatchCount === 0) {
        setLiveMessage(`No results across all feeds for "${searchResults.query}".`);
        return;
      }

      const searchMessage = searchResults.isCapped
        ? `Showing top ${searchResults.maxResults} of ${searchResults.totalMatchCount} results across all feeds for "${searchResults.query}".`
        : `${searchResults.totalMatchCount} result${searchResults.totalMatchCount === 1 ? "" : "s"} across all feeds for "${searchResults.query}".`;
      setLiveMessage(searchMessage);
      return;
    }

    const countMessage =
      visibleArticles.length === 0
        ? emptyStateMessage
        : `${visibleArticles.length} article${visibleArticles.length === 1 ? "" : "s"}`;
    setLiveMessage(countMessage);
  }, [
    emptyStateMessage,
    isSearchActive,
    searchResults.isCapped,
    searchResults.maxResults,
    searchResults.query,
    searchResults.totalMatchCount,
    visibleArticles.length,
  ]);

  return (
    <div className={styles.workspace}>
      <p className="sr-only" aria-live="polite">
        {liveMessage}
      </p>

      <Layout
        sidebar={
          <Sidebar
            feeds={feeds}
            folders={folders}
            selectedScope={selectedScope}
            isMobile={isMobile}
            onSelectAll={() => handleSelectScope({ type: "all" })}
            onSelectUncategorized={() => handleSelectScope({ type: "uncategorized" })}
            onSelectFolder={(folderId) => handleSelectScope({ type: "folder", folderId })}
            onSelectFeed={(feedId) => handleSelectScope({ type: "feed", feedId })}
            isAddFeedFormVisible={isAddFeedFormVisible}
            addFeedStage={addFeedStage}
            feedUrlInput={feedUrlInput}
            inlineDuplicateMessage={inlineDuplicateMessage}
            addFeedFolderIds={addFeedFolderIds}
            addFeedNewFolderNameInput={addFeedNewFolderNameInput}
            discoveryCandidates={discoveryCandidates}
            selectedDiscoveryCandidateUrl={selectedDiscoveryCandidateUrl}
            createdFolderRenameId={createdFolderRenameId}
            isAddingFeed={isAddingFeed}
            isRefreshingFeeds={isRefreshingFeeds}
            isCreatingFolder={isCreatingFolder}
            onShowAddFeedForm={showAddFeedForm}
            onRefresh={() => {
              void handleRefresh();
            }}
            onCancelAddFeed={cancelAddFeedForm}
            onFeedUrlChange={setFeedUrlInput}
            onToggleAddFeedFolder={toggleAddFeedFolder}
            onSetAddFeedFolders={setAddFeedFolderIds}
            onAddFeedNewFolderNameChange={setAddFeedNewFolderNameInput}
            onSelectDiscoveryCandidate={selectDiscoveryCandidate}
            onCreateFolderFromAddFeed={() => {
              void createFolderFromAddFeed();
            }}
            onRenameFolderFromAddFeed={(folderId, name) => {
              return renameFolderFromAddFeed(folderId, name);
            }}
            onDismissCreatedFolderRename={dismissCreatedFolderRename}
            onOpenExistingFeed={(url) => {
              openExistingFeed(url);
            }}
            onSubmitFeed={(event) => {
              void handleAddFeed(event);
            }}
            notices={sidebarNotices}
            onDismissMessage={(id) => {
              dismissNotice(id);
            }}
            deletingFeedId={deletingFeedId}
            renamingFeedId={renamingFeedId}
            updatingFeedFoldersId={updatingFeedFoldersId}
            onRequestFeedRename={(feedId, name) => {
              return handleRenameFeed(feedId, name);
            }}
            onRequestFeedDelete={(feedId) => {
              void handleDeleteFeed(feedId);
            }}
            onRequestFeedFolderUpdate={(feedId, folderIds) => {
              return handleSetFeedFolders(feedId, folderIds);
            }}
            deletingFolderId={deletingFolderId}
            renamingFolderId={renamingFolderId}
            isDeletingUncategorized={isDeletingUncategorized}
            isMovingUncategorized={isMovingUncategorized}
            onCreateFolder={(name) => {
              return createFolderFromSidebar(name);
            }}
            onRequestFolderRename={(folderId, name) => {
              return handleRenameFolder(folderId, name);
            }}
            onRequestFolderDelete={(folderId, mode) => {
              return handleDeleteFolder(folderId, mode);
            }}
            onRequestUncategorizedDelete={() => {
              return handleDeleteUncategorizedFeeds();
            }}
            onRequestUncategorizedMove={(folderId) => {
              return handleMoveUncategorizedFeeds(folderId);
            }}
            onCollapse={handleSidebarCollapse}
          />
        }
        articleList={
          <ArticleList
            articles={visibleArticles}
            selectedArticleId={selectedArticleId}
            openArticleId={openArticleId}
            statusMessage={isSearchActive ? null : listStatusMessage}
            emptyStateMessage={emptyStateMessage}
            isInitialScopeEmpty={selectedScope.type === "none" && !isSearchActive}
            showFeedTitle={isSearchActive || selectedScope.type !== "feed"}
            searchQuery={searchQuery}
            searchIsActive={isSearchActive}
            searchTotalMatchCount={searchResults.totalMatchCount}
            searchMaxResults={searchResults.maxResults}
            searchIsCapped={searchResults.isCapped}
            searchHighlightsByArticleId={searchHighlightsByArticleId}
            paginationInitialized={
              selectedScope.type !== "none" && !isSearchActive
                ? selectedScopePagination.initialized
                : false
            }
            paginationIsLoading={
              selectedScope.type !== "none" && !isSearchActive
                ? selectedScopePagination.isLoading
                : false
            }
            paginationHasMore={
              selectedScope.type !== "none" && !isSearchActive
                ? selectedScopePagination.hasMore
                : false
            }
            paginationError={
              selectedScope.type !== "none" && !isSearchActive
                ? selectedScopePagination.error
                : null
            }
            searchInputRef={searchInputRef}
            onSearchQueryChange={setSearchQuery}
            onRequestLoadMore={() => {
              if (!selectedArticleScope || isSearchActive) {
                return;
              }

              void loadNextPage(selectedArticleScope);
            }}
            onSelectArticle={(articleId) => {
              void openSelectedArticle(articleId);
            }}
          />
        }
        articleReader={<ArticleReader article={openArticle} />}
        sidebarCollapsed={sidebarCollapsed}
        onToggleSidebar={handleToggleSidebar}
        listCollapsed={listCollapsed}
        onCollapseList={handleCollapseList}
        onToggleList={handleToggleList}
        isMobile={isMobile}
        mobileView={mobileView}
        mobileListTitle={isSearchActive ? "Search results" : selectedScopeLabel}
        onMobileBackToFeeds={onMobileBackToFeeds}
        onMobileBackToArticles={onMobileBackToArticles}
      />

      <KeyboardShortcutsModal open={isShortcutsModalOpen} onClose={closeShortcutsModal} />
    </div>
  );
}
