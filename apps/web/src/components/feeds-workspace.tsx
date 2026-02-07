"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArticleList } from "./ArticleList";
import { ArticleReader } from "./ArticleReader";
import { Layout } from "./Layout";
import { Sidebar, SidebarScope } from "./Sidebar";
import { Toolbar } from "./Toolbar";
import type {
  ArticleViewModel,
  FeedViewModel,
  FolderViewModel,
  PendingAction,
} from "./feeds-types";
import { extractArticleSnippet } from "@/utils/articleText";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { loadWorkspaceSnapshot, saveWorkspaceSnapshot } from "@/lib/offline-cache";
import styles from "./feeds-workspace.module.css";

interface FeedsWorkspaceProps {
  initialFeeds: FeedViewModel[];
  initialFolders: FolderViewModel[];
}

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
  feed?: FeedViewModel;
  duplicate?: boolean;
  message?: string;
}

interface ExtractResponse {
  itemId?: string;
  status?: "success" | "fallback";
  source?: string;
  extractedHtml?: string | null;
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
 * Builds a readable feed label from title or URL fallback.
 */
function getFeedLabel(feed: FeedViewModel): string {
  if (feed.title?.trim()) {
    return feed.title.trim();
  }

  try {
    return new URL(feed.url).hostname.replace(/^www\./, "");
  } catch {
    return feed.url;
  }
}

/**
 * Converts ISO values into comparable numeric timestamps.
 */
function toTimeValue(iso: string | null): number {
  if (!iso) {
    return 0;
  }

  const parsed = Date.parse(iso);
  return Number.isNaN(parsed) ? 0 : parsed;
}

/**
 * Build the default bounded reading scope (no "All feeds" aggregate view).
 */
function getDefaultScope(folders: FolderViewModel[]): SidebarScope {
  if (folders.length > 0) {
    const sorted = [...folders].sort((a, b) => a.name.localeCompare(b.name));
    return { type: "folder", folderId: sorted[0].id };
  }

  return { type: "uncategorized" };
}

/**
 * Client orchestrator for feed subscriptions, article list state, and reader state.
 */
export function FeedsWorkspace({
  initialFeeds,
  initialFolders,
}: FeedsWorkspaceProps) {
  const router = useRouter();
  const searchInputRef = useRef<HTMLInputElement>(null);
  const requestedExtractionIds = useRef<Set<string>>(new Set());

  const [feeds, setFeeds] = useState<FeedViewModel[]>(initialFeeds);
  const [folders, setFolders] = useState<FolderViewModel[]>(initialFolders);

  const [selectedScope, setSelectedScope] = useState<SidebarScope>(() =>
    getDefaultScope(initialFolders)
  );
  const [expandedFolderIds, setExpandedFolderIds] = useState<Set<string>>(
    () => new Set(initialFolders.map((folder) => folder.id))
  );

  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [selectedArticleId, setSelectedArticleId] = useState<string | null>(null);
  const [openArticleId, setOpenArticleId] = useState<string | null>(null);

  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isAddFeedFormVisible, setIsAddFeedFormVisible] = useState(false);
  const [isAddFolderFormVisible, setIsAddFolderFormVisible] = useState(false);

  const [feedUrlInput, setFeedUrlInput] = useState("");
  const [folderNameInput, setFolderNameInput] = useState("");

  const [isAddingFeed, setIsAddingFeed] = useState(false);
  const [isAddingFolder, setIsAddingFolder] = useState(false);
  const [isRefreshingFeeds, setIsRefreshingFeeds] = useState(false);
  const [isApplyingAction, setIsApplyingAction] = useState(false);

  const [infoMessage, setInfoMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [networkMessage, setNetworkMessage] = useState<string | null>(null);
  const [liveMessage, setLiveMessage] = useState("");

  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);

  const [isMobile, setIsMobile] = useState(false);
  const [mobileView, setMobileView] = useState<"feeds" | "articles" | "reader">(
    "feeds"
  );

  useEffect(() => {
    setFeeds(initialFeeds);
  }, [initialFeeds]);

  useEffect(() => {
    setFolders(initialFolders);
    setExpandedFolderIds((previous) => {
      const currentFolderIds = new Set(initialFolders.map((folder) => folder.id));
      const next = new Set<string>();
      for (const id of previous) {
        if (currentFolderIds.has(id)) {
          next.add(id);
        }
      }
      return next;
    });
  }, [initialFolders]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setDebouncedQuery(searchQuery);
    }, 150);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [searchQuery]);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(max-width: 767px)");

    const applyMobileState = () => {
      setIsMobile(mediaQuery.matches);
      if (!mediaQuery.matches) {
        setMobileView("feeds");
      }
    };

    applyMobileState();
    mediaQuery.addEventListener("change", applyMobileState);

    return () => {
      mediaQuery.removeEventListener("change", applyMobileState);
    };
  }, []);

  useEffect(() => {
    if (!isMobile) {
      return;
    }

    const currentState = window.history.state || {};
    if (!currentState.feedmyowlView) {
      window.history.replaceState({ ...currentState, feedmyowlView: "feeds" }, "");
    }

    const onPopState = (event: PopStateEvent) => {
      const nextView = event.state?.feedmyowlView;
      if (nextView === "feeds" || nextView === "articles" || nextView === "reader") {
        setMobileView(nextView);
      }
    };

    window.addEventListener("popstate", onPopState);
    return () => {
      window.removeEventListener("popstate", onPopState);
    };
  }, [isMobile]);

  useEffect(() => {
    void saveWorkspaceSnapshot({
      savedAt: new Date().toISOString(),
      feeds,
      folders,
    }).catch(() => {
      // Snapshot cache failures should not interrupt reading flow.
    });
  }, [feeds, folders]);

  useEffect(() => {
    if (navigator.onLine) {
      return;
    }

    void loadWorkspaceSnapshot()
      .then((snapshot) => {
        if (!snapshot) {
          return;
        }

        setFeeds(snapshot.feeds);
        setFolders(snapshot.folders);
        setNetworkMessage(
          "Could not connect to the server. Previously loaded articles are available."
        );
      })
      .catch(() => {
        // If snapshot loading fails, the UI falls back to current in-memory data.
      });
  }, []);

  useEffect(() => {
    const onOnline = () => setNetworkMessage(null);
    const onOffline = () =>
      setNetworkMessage("Could not connect to the server. Previously loaded data remains available.");

    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);

    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  useEffect(() => {
    // Keep selected scope valid as data changes.
    if (selectedScope.type === "feed") {
      const stillExists = feeds.some((feed) => feed.id === selectedScope.feedId);
      if (!stillExists) {
        setSelectedScope(getDefaultScope(folders));
      }
      return;
    }

    if (selectedScope.type === "folder") {
      const stillExists = folders.some((folder) => folder.id === selectedScope.folderId);
      if (!stillExists) {
        setSelectedScope(getDefaultScope(folders));
      }
    }
  }, [feeds, folders, selectedScope]);

  const allArticles = useMemo<ArticleViewModel[]>(() => {
    const flattened = feeds.flatMap((feed) =>
      feed.items.map(
        (item): ArticleViewModel => ({
          id: item.id,
          title: item.title || "Untitled article",
          link: item.link,
          content: item.content,
          author: item.author,
          publishedAt: item.publishedAt,
          readAt: item.readAt,
          extractedHtml: item.extractedHtml || null,
          extractedAt: item.extractedAt || null,
          extractionStatus: item.extractionStatus || null,
          extractionSource: item.extractionSource || null,
          createdAt: item.createdAt,
          feedId: feed.id,
          feedTitle: getFeedLabel(feed),
          snippet: extractArticleSnippet(item.content),
        })
      )
    );

    flattened.sort((a, b) => {
      const aDate = toTimeValue(a.publishedAt) || toTimeValue(a.createdAt);
      const bDate = toTimeValue(b.publishedAt) || toTimeValue(b.createdAt);
      return bDate - aDate;
    });

    return flattened;
  }, [feeds]);

  const feedToFolderMap = useMemo(() => {
    const map = new Map<string, string | null>();

    for (const feed of feeds) {
      map.set(feed.id, feed.folderId);
    }

    return map;
  }, [feeds]);

  const scopedFeeds = useMemo(() => {
    if (selectedScope.type === "feed") {
      return feeds.filter((feed) => feed.id === selectedScope.feedId);
    }

    if (selectedScope.type === "folder") {
      return feeds.filter((feed) => feed.folderId === selectedScope.folderId);
    }

    return feeds.filter((feed) => !feed.folderId);
  }, [feeds, selectedScope]);

  const scopedArticles = useMemo(() => {
    if (selectedScope.type === "feed") {
      return allArticles.filter((article) => article.feedId === selectedScope.feedId);
    }

    if (selectedScope.type === "folder") {
      return allArticles.filter(
        (article) => feedToFolderMap.get(article.feedId) === selectedScope.folderId
      );
    }

    return allArticles.filter((article) => feedToFolderMap.get(article.feedId) === null);
  }, [allArticles, feedToFolderMap, selectedScope]);

  const visibleArticles = useMemo(() => {
    const normalizedQuery = debouncedQuery.trim().toLowerCase();
    if (!normalizedQuery) {
      return scopedArticles;
    }

    return scopedArticles.filter((article) => {
      const haystack = `${article.title} ${article.snippet}`.toLowerCase();
      return haystack.includes(normalizedQuery);
    });
  }, [debouncedQuery, scopedArticles]);

  const openArticle = useMemo(
    () => allArticles.find((article) => article.id === openArticleId) || null,
    [allArticles, openArticleId]
  );

  const selectedScopeLabel = useMemo(() => {
    if (selectedScope.type === "feed") {
      const feed = feeds.find((candidate) => candidate.id === selectedScope.feedId);
      return feed ? getFeedLabel(feed) : "Articles";
    }

    if (selectedScope.type === "folder") {
      const folder = folders.find((candidate) => candidate.id === selectedScope.folderId);
      return folder?.name || "Articles";
    }

    return "Uncategorized";
  }, [feeds, folders, selectedScope]);

  const listStatusMessage = useMemo(() => {
    const erroredFeeds = scopedFeeds.filter(
      (feed) => feed.lastFetchStatus === "error" && feed.lastFetchErrorMessage
    );

    if (selectedScope.type === "feed") {
      return erroredFeeds[0]?.lastFetchErrorMessage || null;
    }

    if (erroredFeeds.length > 0) {
      return erroredFeeds[0].lastFetchErrorMessage || null;
    }

    return null;
  }, [scopedFeeds, selectedScope.type]);

  const emptyStateMessage = useMemo(() => {
    if (feeds.length === 0) {
      return "Add a feed to get started.";
    }

    if (debouncedQuery.trim() && visibleArticles.length === 0) {
      return "No articles match your search.";
    }

    if (selectedScope.type === "feed") {
      return "No articles in this feed.";
    }

    if (scopedFeeds.length === 0) {
      return "No feeds in this folder.";
    }

    return "No articles in this folder.";
  }, [debouncedQuery, feeds.length, scopedFeeds.length, selectedScope.type, visibleArticles.length]);

  useEffect(() => {
    if (!selectedArticleId) {
      if (visibleArticles.length > 0) {
        setSelectedArticleId(visibleArticles[0].id);
      }
      return;
    }

    const stillVisible = visibleArticles.some(
      (article) => article.id === selectedArticleId
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

    const element = document.querySelector(
      `[data-article-id="${selectedArticleId}"]`
    );

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

  const setMobileViewWithHistory = useCallback(
    (nextView: "feeds" | "articles" | "reader", shouldPush = true) => {
      if (!isMobile) {
        return;
      }

      setMobileView(nextView);

      if (shouldPush) {
        const currentState = window.history.state || {};
        window.history.pushState({ ...currentState, feedmyowlView: nextView }, "");
      }
    },
    [isMobile]
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
    [allArticles]
  );

  const requestArticleExtraction = useCallback(async (articleId: string) => {
    if (requestedExtractionIds.current.has(articleId)) {
      return;
    }

    requestedExtractionIds.current.add(articleId);

    try {
      const response = await fetch("/api/feeds", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "item.extractFull", itemId: articleId }),
      });

      if (!response.ok) {
        return;
      }

      const body = await parseResponseJson<ExtractResponse>(response);
      if (!body?.itemId) {
        return;
      }

      setFeeds((previousFeeds) =>
        previousFeeds.map((feed) => ({
          ...feed,
          items: feed.items.map((item) => {
            if (item.id !== body.itemId) {
              return item;
            }

            return {
              ...item,
              extractedHtml: body.extractedHtml || item.extractedHtml || null,
              extractionStatus: body.status || item.extractionStatus || null,
              extractionSource: body.source || item.extractionSource || null,
              extractedAt: new Date().toISOString(),
            };
          }),
        }))
      );
    } catch {
      // Extraction is best-effort and should fail quietly.
    }
  }, []);

  const openSelectedArticle = useCallback(
    async (articleId: string) => {
      setSelectedArticleId(articleId);
      setOpenArticleId(articleId);
      setInfoMessage(null);
      setErrorMessage(null);
      await markArticleAsRead(articleId);
      focusReaderTitle();

      if (isMobile) {
        setMobileViewWithHistory("reader", true);
      }
    },
    [focusReaderTitle, isMobile, markArticleAsRead, setMobileViewWithHistory]
  );

  const moveSelectionBy = useCallback(
    (step: number) => {
      if (visibleArticles.length === 0) {
        setSelectedArticleId(null);
        return;
      }

      const index = visibleArticles.findIndex(
        (article) => article.id === selectedArticleId
      );

      if (index < 0) {
        setSelectedArticleId(visibleArticles[0].id);
        return;
      }

      const nextIndex = Math.max(0, Math.min(visibleArticles.length - 1, index + step));
      setSelectedArticleId(visibleArticles[nextIndex].id);
    },
    [selectedArticleId, visibleArticles]
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
          (total, result) =>
            total + (result.status === "success" ? result.newItemCount : 0),
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
      setErrorMessage("Could not connect to the server. Previously loaded articles are still available.");
      setIsRefreshingFeeds(false);
    }
  }, [isRefreshingFeeds, router]);

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
    [feedUrlInput, isAddingFeed, isMobile, router, setMobileViewWithHistory]
  );

  const handleCreateFolder = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();

      if (isAddingFolder) {
        return;
      }

      if (!navigator.onLine) {
        setNetworkMessage("You appear to be offline. This action requires an internet connection.");
        return;
      }

      const nextName = folderNameInput.trim();
      if (!nextName) {
        setErrorMessage("Folder name is required.");
        return;
      }

      setIsAddingFolder(true);
      setErrorMessage(null);
      setInfoMessage(null);

      try {
        const response = await fetch("/api/feeds", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "folder.create", name: nextName }),
        });
        const body = await parseResponseJson<
          ApiErrorResponse & { folder?: FolderViewModel }
        >(response);

        if (!response.ok) {
          setErrorMessage(body?.error || "Could not create folder.");
          setIsAddingFolder(false);
          return;
        }

        if (body?.folder?.id) {
          setExpandedFolderIds((previous) => {
            const next = new Set(previous);
            next.add(body.folder!.id);
            return next;
          });
          setSelectedScope({ type: "folder", folderId: body.folder.id });
        }

        setFolderNameInput("");
        setIsAddingFolder(false);
        setIsAddFolderFormVisible(false);
        setInfoMessage("Folder created.");
        router.refresh();
      } catch {
        setErrorMessage("Could not connect to the server.");
        setIsAddingFolder(false);
      }
    },
    [folderNameInput, isAddingFolder, router]
  );

  const applyPendingAction = useCallback(async () => {
    if (!pendingAction || isApplyingAction) {
      return;
    }

    setIsApplyingAction(true);
    setErrorMessage(null);
    setInfoMessage(null);

    let response: Response | null = null;

    if (pendingAction.kind === "feed-rename") {
      response = await fetch(`/api/feeds/${pendingAction.feedId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "feed.rename",
          title: pendingAction.draftTitle,
        }),
      });
    }

    if (pendingAction.kind === "folder-rename") {
      response = await fetch("/api/feeds", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "folder.rename",
          folderId: pendingAction.folderId,
          name: pendingAction.draftName,
        }),
      });
    }

    if (pendingAction.kind === "feed-move") {
      response = await fetch(`/api/feeds/${pendingAction.feedId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "feed.move",
          folderId: pendingAction.draftFolderId || null,
        }),
      });
    }

    if (pendingAction.kind === "feed-delete") {
      response = await fetch(`/api/feeds/${pendingAction.feedId}`, {
        method: "DELETE",
      });
    }

    if (pendingAction.kind === "folder-delete") {
      response = await fetch("/api/feeds", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "folder.delete",
          folderId: pendingAction.folderId,
        }),
      });
    }

    if (!response) {
      setIsApplyingAction(false);
      return;
    }

    const body = await parseResponseJson<ApiErrorResponse>(response);

    if (!response.ok) {
      setErrorMessage(body?.error || "Action failed.");
      setIsApplyingAction(false);
      return;
    }

    setPendingAction(null);
    setIsApplyingAction(false);
    setInfoMessage("Action completed.");
    router.refresh();
  }, [isApplyingAction, pendingAction, router]);

  const cancelPendingAction = useCallback(() => {
    setPendingAction(null);
  }, []);

  /** Clears both info and error messages from the sidebar. */
  const handleDismissMessage = useCallback(() => {
    setInfoMessage(null);
    setErrorMessage(null);
  }, []);

  /** Opens add-feed UI and hides folder form to keep actions inline and focused. */
  const handleShowAddFeedForm = useCallback(() => {
    setIsAddFeedFormVisible(true);
    setIsAddFolderFormVisible(false);
  }, []);

  const handleSelectScope = useCallback(
    (nextScope: SidebarScope) => {
      setSelectedScope(nextScope);
      setOpenArticleId(null);
      focusArticleList();

      if (isMobile) {
        setMobileViewWithHistory("articles", true);
      }
    },
    [focusArticleList, isMobile, setMobileViewWithHistory]
  );

  useKeyboardShortcuts({
    onNextArticle: () => moveSelectionBy(1),
    onPreviousArticle: () => moveSelectionBy(-1),
    onOpenArticle: () => {
      if (selectedArticleId) {
        void openSelectedArticle(selectedArticleId);
      }
    },
    onRefreshFeeds: () => {
      void handleRefresh();
    },
    onFocusSearch: () => {
      searchInputRef.current?.focus();
    },
    onClearSearch: () => {
      setSearchQuery("");
      setDebouncedQuery("");
    },
    onToggleSidebar: () => {
      if (!isMobile) {
        setIsSidebarCollapsed((previous) => !previous);
      }
    },
  });

  useEffect(() => {
    const countMessage =
      visibleArticles.length === 0
        ? emptyStateMessage
        : `${visibleArticles.length} article${visibleArticles.length === 1 ? "" : "s"}`;
    setLiveMessage(countMessage);
  }, [emptyStateMessage, visibleArticles.length]);

  return (
    <div className={styles.workspace}>
      <p className="sr-only" aria-live="polite">
        {liveMessage}
      </p>

      <Layout
        toolbar={
          <div>
            <Toolbar
              query={searchQuery}
              searchInputRef={searchInputRef}
              isRefreshing={isRefreshingFeeds}
              onQueryChange={setSearchQuery}
              onRefresh={() => {
                void handleRefresh();
              }}
              onShowAddFeedForm={handleShowAddFeedForm}
            />
            {networkMessage ? <p className={styles.toolbarMessage}>{networkMessage}</p> : null}
          </div>
        }
        sidebar={
          <Sidebar
            folders={folders}
            feeds={feeds}
            expandedFolderIds={expandedFolderIds}
            selectedScope={selectedScope}
            onSelectFolder={(folderId) => handleSelectScope({ type: "folder", folderId })}
            onSelectUncategorized={() => handleSelectScope({ type: "uncategorized" })}
            onSelectFeed={(feedId) => handleSelectScope({ type: "feed", feedId })}
            onToggleFolder={(folderId) => {
              setExpandedFolderIds((previous) => {
                const next = new Set(previous);
                if (next.has(folderId)) {
                  next.delete(folderId);
                } else {
                  next.add(folderId);
                }
                return next;
              });
            }}
            onToggleSidebar={() => setIsSidebarCollapsed((previous) => !previous)}
            isAddFeedFormVisible={isAddFeedFormVisible}
            feedUrlInput={feedUrlInput}
            isAddingFeed={isAddingFeed}
            onShowAddFeedForm={handleShowAddFeedForm}
            onCancelAddFeed={() => setIsAddFeedFormVisible(false)}
            onFeedUrlChange={setFeedUrlInput}
            onSubmitFeed={(event) => {
              void handleAddFeed(event);
            }}
            isAddFolderFormVisible={isAddFolderFormVisible}
            folderNameInput={folderNameInput}
            isAddingFolder={isAddingFolder}
            onShowAddFolderForm={() => {
              setIsAddFolderFormVisible(true);
              setIsAddFeedFormVisible(false);
            }}
            onCancelAddFolder={() => setIsAddFolderFormVisible(false)}
            onFolderNameChange={setFolderNameInput}
            onSubmitFolder={(event) => {
              void handleCreateFolder(event);
            }}
            infoMessage={infoMessage}
            errorMessage={errorMessage}
            onDismissMessage={handleDismissMessage}
            pendingAction={pendingAction}
            isApplyingAction={isApplyingAction}
            onApplyPendingAction={applyPendingAction}
            onCancelPendingAction={cancelPendingAction}
            onPendingActionChange={setPendingAction}
            onRequestFeedRename={(feedId, currentLabel) => {
              setPendingAction({
                kind: "feed-rename",
                feedId,
                draftTitle: currentLabel,
              });
            }}
            onRequestFeedMove={(feedId, currentFolderId) => {
              setPendingAction({
                kind: "feed-move",
                feedId,
                draftFolderId: currentFolderId,
              });
            }}
            onRequestFeedDelete={(feedId, currentLabel) => {
              setPendingAction({
                kind: "feed-delete",
                feedId,
                feedLabel: currentLabel,
              });
            }}
            onRequestFolderRename={(folderId, currentName) => {
              setPendingAction({
                kind: "folder-rename",
                folderId,
                draftName: currentName,
              });
            }}
            onRequestFolderDelete={(folderId, currentName) => {
              setPendingAction({
                kind: "folder-delete",
                folderId,
                folderLabel: currentName,
              });
            }}
          />
        }
        articleList={
          <ArticleList
            articles={visibleArticles}
            selectedArticleId={selectedArticleId}
            openArticleId={openArticleId}
            statusMessage={listStatusMessage}
            emptyStateMessage={emptyStateMessage}
            onSelectArticle={(articleId) => {
              void openSelectedArticle(articleId);
            }}
          />
        }
        articleReader={
          <ArticleReader
            article={openArticle}
            onRequestExtraction={(articleId) => {
              void requestArticleExtraction(articleId);
            }}
          />
        }
        isSidebarCollapsed={isSidebarCollapsed}
        onToggleSidebar={() => setIsSidebarCollapsed((previous) => !previous)}
        isMobile={isMobile}
        mobileView={mobileView}
        mobileListTitle={selectedScopeLabel}
        onMobileBackToFeeds={() => {
          if (window.history.length > 1) {
            window.history.back();
          } else {
            setMobileViewWithHistory("feeds", false);
          }
        }}
        onMobileBackToArticles={() => {
          if (window.history.length > 1) {
            window.history.back();
          } else {
            setMobileViewWithHistory("articles", false);
          }
        }}
      />
    </div>
  );
}
