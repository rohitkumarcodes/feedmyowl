"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArticleList } from "./ArticleList";
import { ArticleReader } from "./ArticleReader";
import { KeyboardShortcutsModal } from "./KeyboardShortcutsModal";
import { Layout } from "./Layout";
import { Sidebar } from "./sidebar/Sidebar";
import { resolveVimArticleNavigation } from "@/features/feeds/state/article-keyboard-navigation";
import {
  parseSidebarRowKey,
  resolveSidebarArrowNavigation,
} from "@/features/feeds/state/sidebar-keyboard-navigation";
import {
  scrollReaderByLine,
  scrollReaderByPage,
} from "@/features/feeds/state/article-reader-scroll";
import {
  advancePaneFocusCycle,
  type PaneCyclePhase,
} from "@/features/feeds/state/pane-focus-cycle";
import {
  cycleActivePanel,
  resolveActivePanelAfterLayoutChange,
  type ActivePanel,
} from "@/features/feeds/state/active-panel";
import {
  buildArticleSearchResults,
  type ArticleSearchHighlights,
} from "@/features/feeds/state/article-search";
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
} from "@/features/feeds/state/article-pagination-state";
import { buildSidebarNotices } from "./sidebar/sidebar-messages";
import type { FeedViewModel, FolderViewModel } from "@/features/feeds/types/view-models";
import type { SidebarScope } from "@/features/feeds/types/scopes";
import {
  doesArticleMatchSidebarScope,
  selectAllArticles,
  selectEmptyStateMessage,
  selectListStatusMessage,
  selectOpenArticle,
  selectScopeLabel,
  selectVisibleArticles,
} from "@/features/feeds/state/feeds-workspace.selectors";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";
import { useFeedsWorkspaceActions } from "@/features/feeds/hooks/useFeedsWorkspaceActions";
import { useFeedsWorkspaceMobile } from "@/features/feeds/hooks/useFeedsWorkspaceMobile";
import { useFeedsWorkspaceNetwork } from "@/features/feeds/hooks/useFeedsWorkspaceNetwork";
import {
  DEFAULT_ARTICLE_PAGE_LIMIT,
  scopeToKey,
  type ArticlePageResponseBody,
  type ArticleScope,
} from "@/lib/shared/article-pagination";
import { parseResponseJson } from "@/lib/client/http";
import { OFFLINE_CACHED_ARTICLES_MESSAGE } from "@/lib/shared/network-messages";
import type { ReadingMode } from "@/lib/shared/reading-mode";
import { OPEN_SHORTCUTS_DIALOG_EVENT } from "@/lib/shared/shortcuts-dialog-events";
import { computeUnreadCounts } from "@/features/feeds/state/unread-counts";
import styles from "./FeedsWorkspace.module.css";

interface FeedsWorkspaceProps {
  initialFeeds: FeedViewModel[];
  initialFolders: FolderViewModel[];
  initialPaginationByScopeKey: PaginationByScopeKey;
  initialReadingMode: ReadingMode;
}

interface ApiErrorResponse {
  error?: string;
}

function toArticleScope(scope: SidebarScope): ArticleScope | null {
  if (scope.type === "all") {
    return { type: "all" };
  }

  if (scope.type === "unread") {
    return { type: "unread" };
  }

  if (scope.type === "saved") {
    return { type: "saved" };
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
  initialReadingMode,
}: FeedsWorkspaceProps) {
  const router = useRouter();

  const [feeds, setFeeds] = useState<FeedViewModel[]>(initialFeeds);
  const [folders, setFolders] = useState<FolderViewModel[]>(initialFolders);
  const readingMode: ReadingMode = initialReadingMode;
  const [paginationByScopeKey, setPaginationByScopeKey] = useState<PaginationByScopeKey>(
    initialPaginationByScopeKey,
  );
  const [selectedScope, setSelectedScope] = useState<SidebarScope>({ type: "none" });
  const [selectedArticleId, setSelectedArticleId] = useState<string | null>(null);
  const [openArticleId, setOpenArticleId] = useState<string | null>(null);
  /**
   * Canonical "which pane is keyboard input for" state. Always points to a
   * visible pane. Updated by clicks, keyboard navigation that lands in a
   * pane, ArrowLeft/Right cycling, and pane collapse/expand (which auto-
   * advances the active pane when the current one becomes hidden).
   */
  const [activePanel, setActivePanel] = useState<ActivePanel>("sidebar");
  const [liveMessage, setLiveMessage] = useState("");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [listCollapsed, setListCollapsed] = useState(false);
  const [, setPaneCyclePhase] = useState<PaneCyclePhase>(0);
  const [isShortcutsModalOpen, setIsShortcutsModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const sidebarCollapsedRef = useRef(sidebarCollapsed);
  const listCollapsedRef = useRef(listCollapsed);
  const searchInputRef = useRef<HTMLInputElement>(null);
  /** Saves the article list scroll position before navigating to mobile reader. */
  const mobileListScrollRef = useRef(0);
  const prefersReducedMotion = usePrefersReducedMotion();

  useEffect(() => {
    setFeeds((previousFeeds) =>
      mergeServerFeedsWithLoadedItems(previousFeeds, initialFeeds),
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
      }),
    );
  }, [initialPaginationByScopeKey]);

  useEffect(() => {
    setFolders(initialFolders);
  }, [initialFolders]);

  useEffect(() => {
    sidebarCollapsedRef.current = sidebarCollapsed;
  }, [sidebarCollapsed]);

  useEffect(() => {
    listCollapsedRef.current = listCollapsed;
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

  /** Unread counts per feed and folder — only computed in checker mode. */
  const unreadCounts = useMemo(
    () => (readingMode === "checker" ? computeUnreadCounts(feeds) : null),
    [feeds, readingMode],
  );

  const scopedArticles = useMemo(
    () => selectVisibleArticles(allArticles, selectedScope),
    [allArticles, selectedScope],
  );

  const searchResults = useMemo(
    () =>
      buildArticleSearchResults(allArticles, searchQuery, {
        minQueryLength: 2,
        maxResults: 50,
      }),
    [allArticles, searchQuery],
  );

  const isSearchActive = searchResults.isActive;

  const visibleArticles = useMemo(
    () =>
      isSearchActive
        ? searchResults.results.map((result) => result.article)
        : scopedArticles,
    [isSearchActive, scopedArticles, searchResults.results],
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
    [allArticles, openArticleId],
  );

  const selectedScopeLabel = useMemo(
    () => selectScopeLabel(feeds, folders, selectedScope),
    [feeds, folders, selectedScope],
  );

  const listStatusMessage = useMemo(
    () => selectListStatusMessage(feeds, selectedScope),
    [feeds, selectedScope],
  );

  const emptyStateMessage = useMemo(
    () => selectEmptyStateMessage(feeds.length, selectedScope),
    [feeds.length, selectedScope],
  );

  const selectedArticleScope = useMemo(
    () => toArticleScope(selectedScope),
    [selectedScope],
  );

  const selectedScopePagination = useMemo(() => {
    if (!selectedArticleScope) {
      return createUninitializedScopePaginationState();
    }

    return getScopePaginationState(
      paginationByScopeKey,
      scopeToKey(selectedArticleScope),
    );
  }, [paginationByScopeKey, selectedArticleScope]);

  /**
   * True while articles are being fetched for a newly selected scope.
   * Prevents a flash of "No articles in this feed." before the first page
   * of articles arrives from the API.
   */
  const isLoadingArticles = useMemo(() => {
    if (isSearchActive) return false;
    if (selectedScope.type === "none") return false;
    if (visibleArticles.length > 0) return false;
    return !selectedScopePagination.initialized || selectedScopePagination.isLoading;
  }, [isSearchActive, selectedScope, visibleArticles, selectedScopePagination]);

  const {
    isAddFeedFormVisible,
    addFeedStage,
    addFeedProgressMessage,
    feedUrlInput,
    addFeedFieldError,
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
    savingItemId,
    deletingFolderId,
    renamingFolderId,
    isDeletingUncategorized,
    isMovingUncategorized,
    queuedNotices,
    setFeedUrlInput,
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
    markAllArticlesAsRead,
    toggleArticleSaved,
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
    // If the user is in unread scope but switches to reader mode,
    // the unread scope no longer makes sense — fall back to "all".
    if (selectedScope.type === "unread" && readingMode !== "checker") {
      setSelectedScope({ type: "all" });
      return;
    }

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
  }, [feeds, folders, readingMode, selectedScope]);

  useEffect(() => {
    if (!selectedArticleId) {
      if (visibleArticles.length > 0) {
        setSelectedArticleId(visibleArticles[0].id);
      }
      return;
    }

    const stillVisible = visibleArticles.some(
      (article) => article.id === selectedArticleId,
    );
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

  /**
   * Moves DOM focus to the root of the named pane. Each pane root carries a
   * data-attribute (data-sidebar-root / data-article-list-root /
   * data-article-reader-root) and tabIndex={-1}, so they can be focused
   * programmatically without being part of the regular tab order.
   */
  const focusPanelRoot = useCallback((panel: ActivePanel) => {
    const selector =
      panel === "sidebar"
        ? "[data-sidebar-root]"
        : panel === "list"
          ? "[data-article-list-root]"
          : "[data-article-reader-root]";
    window.setTimeout(() => {
      const root = document.querySelector<HTMLElement>(selector);
      root?.focus();
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

  /**
   * Marks the reader as the last-interacted pane when the user clicks or
   * scrolls within it, so subsequent ArrowUp/Down keys scroll the reader
   * instead of moving article-list selection.
   */
  useEffect(() => {
    const handleReaderInteract = (event: Event) => {
      const target = event.target;
      if (!(target instanceof Node)) {
        return;
      }
      const readerRoot = document.querySelector<HTMLElement>(
        "[data-article-reader-root]",
      );
      if (readerRoot && readerRoot.contains(target)) {
        setActivePanel("reader");
      }
    };

    document.addEventListener("mousedown", handleReaderInteract);
    document.addEventListener("wheel", handleReaderInteract, { passive: true });

    return () => {
      document.removeEventListener("mousedown", handleReaderInteract);
      document.removeEventListener("wheel", handleReaderInteract);
    };
  }, []);

  /**
   * Marks the article list as the last-interacted pane when the user clicks
   * inside it (selecting an article, scrolling). Mirrors the reader handler.
   */
  useEffect(() => {
    const handleListInteract = (event: Event) => {
      const target = event.target;
      if (!(target instanceof Node)) {
        return;
      }
      const listRoot = document.querySelector<HTMLElement>("[data-article-list-root]");
      if (listRoot && listRoot.contains(target)) {
        setActivePanel("list");
      }
    };

    document.addEventListener("mousedown", handleListInteract);

    return () => {
      document.removeEventListener("mousedown", handleListInteract);
    };
  }, []);

  /**
   * Marks the sidebar as the last-interacted pane when the user clicks
   * inside it. Catches all click paths (folders, feed rows, scope rows)
   * without each handler having to remember to set the state.
   */
  useEffect(() => {
    const handleSidebarInteract = (event: Event) => {
      const target = event.target;
      if (!(target instanceof Node)) {
        return;
      }
      const sidebarRoot = document.querySelector<HTMLElement>("[data-sidebar-root]");
      if (sidebarRoot && sidebarRoot.contains(target)) {
        setActivePanel("sidebar");
      }
    };

    document.addEventListener("mousedown", handleSidebarInteract);

    return () => {
      document.removeEventListener("mousedown", handleSidebarInteract);
    };
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
      window.removeEventListener(OPEN_SHORTCUTS_DIALOG_EVENT, handleOpenShortcutsDialog);
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
      const readerRoot = document.querySelector<HTMLElement>(
        "[data-article-reader-root]",
      );
      if (!readerRoot) {
        return false;
      }

      const behavior: ScrollBehavior = prefersReducedMotion ? "auto" : "smooth";
      return scrollReaderByPage(readerRoot, direction, behavior);
    },
    [prefersReducedMotion],
  );

  const handleToggleSidebar = useCallback(() => {
    setSidebarCollapsed((previous) => {
      const next = !previous;
      sidebarCollapsedRef.current = next;
      return next;
    });
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
        currentPhase,
      );

      setSidebarCollapsed(result.nextPaneState.sidebarCollapsed);
      setListCollapsed(result.nextPaneState.listCollapsed);
      sidebarCollapsedRef.current = result.nextPaneState.sidebarCollapsed;
      listCollapsedRef.current = result.nextPaneState.listCollapsed;

      return result.nextPhase;
    });
  }, []);

  /**
   * Whenever a pane is collapsed or expanded, ensure activePanel still points
   * at a visible pane. Without this guard, collapsing the active pane would
   * leave keyboard input pointed at hidden state — exactly the "F twice
   * leaves arrows dead" bug.
   */
  useEffect(() => {
    setActivePanel((current) =>
      resolveActivePanelAfterLayoutChange(current, {
        sidebarCollapsed,
        listCollapsed,
      }),
    );
  }, [sidebarCollapsed, listCollapsed]);

  const handleCyclePanel = useCallback(
    (direction: 1 | -1) => {
      const next = cycleActivePanel(activePanel, direction, {
        sidebarCollapsed: sidebarCollapsedRef.current,
        listCollapsed: listCollapsedRef.current,
      });
      if (next === activePanel) {
        return;
      }
      setActivePanel(next);
      focusPanelRoot(next);
    },
    [activePanel, focusPanelRoot],
  );

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
      // Opening from the list keeps the user in "list" mode so subsequent
      // ArrowUp/Down keep navigating articles rather than scrolling the
      // reader. The reader takes over only after the user explicitly
      // clicks/scrolls inside it (see handleReaderInteract below).
      setActivePanel("list");
      focusReaderTitle();
      clearStatusMessages();
      await markArticleAsRead(articleId);

      if (isMobile) {
        const listRoot = document.querySelector("[data-article-list-root]");
        if (listRoot) {
          mobileListScrollRef.current = listRoot.scrollTop;
        }
        setMobileViewWithHistory("reader", true);
      }
    },
    [
      clearStatusMessages,
      focusReaderTitle,
      isMobile,
      markArticleAsRead,
      setMobileViewWithHistory,
    ],
  );

  const loadNextPage = useCallback(
    async (scope: ArticleScope) => {
      const scopeKey = scopeToKey(scope);
      const currentScopePagination = getScopePaginationState(
        paginationByScopeKey,
        scopeKey,
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
        setScopePaginationLoading(previous, scopeKey),
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
          response,
        );

        if (!response.ok || !body) {
          setPaginationByScopeKey((previous) =>
            setScopePaginationError(
              previous,
              scopeKey,
              body?.error || "Could not load more articles.",
            ),
          );
          return;
        }

        setFeeds((previousFeeds) => appendPageItemsToFeeds(previousFeeds, body.items));
        setPaginationByScopeKey((previous) =>
          setScopePaginationSuccess(previous, scopeKey, {
            nextCursor: body.nextCursor,
            hasMore: body.hasMore,
          }),
        );
      } catch {
        setPaginationByScopeKey((previous) =>
          setScopePaginationError(previous, scopeKey, "Could not load more articles."),
        );
      }
    },
    [paginationByScopeKey, setNetworkMessage],
  );

  useEffect(() => {
    if (!selectedArticleScope || isSearchActive) {
      return;
    }

    const scopeKey = scopeToKey(selectedArticleScope);
    const scopePagination = getScopePaginationState(paginationByScopeKey, scopeKey);
    if (
      scopePagination.initialized ||
      scopePagination.isLoading ||
      scopePagination.error
    ) {
      return;
    }

    void loadNextPage(selectedArticleScope);
  }, [isSearchActive, loadNextPage, paginationByScopeKey, selectedArticleScope]);

  const moveSelectionByArrow = useCallback(
    (step: 1 | -1) => {
      setActivePanel("list");

      if (visibleArticles.length === 0) {
        setSelectedArticleId(null);
        return;
      }

      const index = visibleArticles.findIndex(
        (article) => article.id === selectedArticleId,
      );

      const targetId =
        index < 0
          ? visibleArticles[0].id
          : visibleArticles[
              Math.max(0, Math.min(visibleArticles.length - 1, index + step))
            ].id;

      // Auto-open the new selection so the reader follows arrow-key
      // navigation. Mirrors the j/k vim behaviour and the standard preview-
      // pane convention used by Gmail / Reeder / Feedbin.
      void openSelectedArticle(targetId);
    },
    [openSelectedArticle, selectedArticleId, visibleArticles],
  );

  /**
   * Reads the visible sidebar rows from the DOM in render order. Each
   * selectable row carries a `data-sidebar-row="<scope-key>"` attribute
   * (see Sidebar/FolderTree/FeedItem). Using the DOM as the source of
   * truth means the order automatically tracks expand/collapse state and
   * conditional rows (Saved/All/Unread/Uncategorized) without lifting that
   * state into this component.
   */
  const readVisibleSidebarScopes = useCallback((): SidebarScope[] => {
    const nodes = document.querySelectorAll<HTMLElement>("[data-sidebar-row]");
    const scopes: SidebarScope[] = [];
    nodes.forEach((node) => {
      const rowKey = node.getAttribute("data-sidebar-row");
      if (!rowKey) {
        return;
      }
      const scope = parseSidebarRowKey(rowKey);
      if (scope) {
        scopes.push(scope);
      }
    });
    return scopes;
  }, []);

  const scrollSidebarRowIntoView = useCallback((scope: SidebarScope) => {
    let key: string;
    if (scope.type === "folder") {
      key = `folder:${scope.folderId}`;
    } else if (scope.type === "feed") {
      key = `feed:${scope.feedId}`;
    } else {
      key = scope.type;
    }
    const element = document.querySelector(`[data-sidebar-row="${key}"]`);
    if (element) {
      element.scrollIntoView({ block: "nearest" });
    }
  }, []);

  const moveSidebarSelectionByArrow = useCallback(
    (step: 1 | -1) => {
      setActivePanel("sidebar");
      const visibleScopes = readVisibleSidebarScopes();
      const next = resolveSidebarArrowNavigation({
        step,
        currentScope: selectedScope,
        visibleScopes,
      });
      if (!next) {
        return;
      }
      setSelectedScope(next);
      scrollSidebarRowIntoView(next);
    },
    [readVisibleSidebarScopes, scrollSidebarRowIntoView, selectedScope],
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
    ],
  );

  const handleSelectScope = useCallback(
    (nextScope: SidebarScope) => {
      const wasSearchActive = isSearchActive;
      const openArticle = selectOpenArticle(allArticles, openArticleId);

      setSelectedScope(nextScope);
      // Land in the list pane after picking a scope so arrow keys start
      // navigating articles immediately. focusArticleList() below moves DOM
      // focus too.
      setActivePanel("list");

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
    ],
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
    ],
  );

  useKeyboardShortcuts({
    enabled: !isMobile,
    isShortcutsModalOpen,
    isListContextTarget,
    isReaderContextTarget,
    activePanel,
    onNextArticleVim: () => navigateAndOpenByVim(1),
    onPreviousArticleVim: () => navigateAndOpenByVim(-1),
    onNextArticleArrow: () => moveSelectionByArrow(1),
    onPreviousArticleArrow: () => moveSelectionByArrow(-1),
    onNextSidebarItem: () => moveSidebarSelectionByArrow(1),
    onPreviousSidebarItem: () => moveSidebarSelectionByArrow(-1),
    onReaderScrollLineDown: () => scrollReaderByKeyboardLine(1),
    onReaderScrollLineUp: () => scrollReaderByKeyboardLine(-1),
    onReaderScrollPageDown: () => scrollReaderByKeyboardPage(1),
    onReaderScrollPageUp: () => scrollReaderByKeyboardPage(-1),
    onCyclePanel: handleCyclePanel,
    onOpenArticle: () => {
      if (selectedArticleId) {
        void openSelectedArticle(selectedArticleId);
      }
    },
    onToggleSaved: () => {
      if (openArticleId) {
        void toggleArticleSaved(openArticleId);
      }
    },
    onOpenOriginal: () => {
      if (openArticle?.link) {
        window.open(openArticle.link, "_blank", "noopener");
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
            readingMode={readingMode}
            unreadCounts={unreadCounts}
            onSelectAll={() => handleSelectScope({ type: "all" })}
            onSelectUnread={() => handleSelectScope({ type: "unread" })}
            onSelectSaved={() => handleSelectScope({ type: "saved" })}
            onSelectUncategorized={() => handleSelectScope({ type: "uncategorized" })}
            onSelectFolder={(folderId) => handleSelectScope({ type: "folder", folderId })}
            onSelectFeed={(feedId) => handleSelectScope({ type: "feed", feedId })}
            isAddFeedFormVisible={isAddFeedFormVisible}
            addFeedStage={addFeedStage}
            feedUrlInput={feedUrlInput}
            addFeedFieldError={addFeedFieldError}
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
            onAddFeedNewFolderNameChange={setAddFeedNewFolderNameInput}
            onSelectDiscoveryCandidate={selectDiscoveryCandidate}
            onCreateFolderFromAddFeed={() => {
              void createFolderFromAddFeed();
            }}
            onRenameFolderFromAddFeed={(folderId, name) => {
              return renameFolderFromAddFeed(folderId, name);
            }}
            onDismissCreatedFolderRename={dismissCreatedFolderRename}
            onOpenExistingFeed={(url, existingFeedId) => {
              openExistingFeed(url, existingFeedId);
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
          />
        }
        articleList={
          <ArticleList
            articles={visibleArticles}
            selectedArticleId={selectedArticleId}
            openArticleId={openArticleId}
            readingMode={readingMode}
            statusMessage={isSearchActive ? null : listStatusMessage}
            emptyStateMessage={emptyStateMessage}
            isInitialScopeEmpty={selectedScope.type === "none" && !isSearchActive}
            showFeedTitle={isSearchActive || selectedScope.type !== "feed"}
            isLoading={isLoadingArticles}
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
            mobileInitialScrollTop={isMobile ? mobileListScrollRef.current : 0}
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
            onMarkAllRead={
              readingMode === "checker" && selectedArticleScope
                ? () => {
                    void markAllArticlesAsRead(
                      selectedArticleScope.type,
                      "id" in selectedArticleScope ? selectedArticleScope.id : undefined,
                    );
                  }
                : undefined
            }
          />
        }
        articleReader={
          <ArticleReader
            article={openArticle}
            isSavingSaved={Boolean(openArticle && savingItemId === openArticle.id)}
            onToggleSaved={(articleId) => {
              void toggleArticleSaved(articleId);
            }}
          />
        }
        sidebarCollapsed={sidebarCollapsed}
        onToggleSidebar={handleToggleSidebar}
        listCollapsed={listCollapsed}
        onToggleList={handleToggleList}
        activePanel={activePanel}
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
