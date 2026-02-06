"use client";

import {
  FormEvent,
  MouseEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import { AddFeedForm } from "./AddFeedForm";
import { ArticleList } from "./ArticleList";
import { ArticleReader } from "./ArticleReader";
import { Layout } from "./Layout";
import { Sidebar, SidebarScope } from "./Sidebar";
import { Toolbar } from "./Toolbar";
import type { ArticleViewModel, FeedViewModel, FolderViewModel } from "./feeds-types";
import { extractArticleSnippet } from "@/utils/articleText";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import styles from "./feeds-workspace.module.css";

interface FeedsWorkspaceProps {
  initialFeeds: FeedViewModel[];
  initialFolders: FolderViewModel[];
}

interface ApiErrorResponse {
  error?: string;
}

interface RefreshResult {
  feedId: string;
  feedUrl: string;
  newItemCount: number;
  status: "success" | "error";
  error?: string;
}

interface RefreshResponse {
  results?: RefreshResult[];
}

type ContextMenuState =
  | {
      kind: "feed";
      id: string;
      x: number;
      y: number;
    }
  | {
      kind: "folder";
      id: string;
      x: number;
      y: number;
    };

type PendingAction =
  | {
      kind: "feed-rename";
      feedId: string;
      draftTitle: string;
    }
  | {
      kind: "folder-rename";
      folderId: string;
      draftName: string;
    }
  | {
      kind: "feed-move";
      feedId: string;
      draftFolderId: string;
    }
  | {
      kind: "feed-delete";
      feedId: string;
      feedLabel: string;
    }
  | {
      kind: "folder-delete";
      folderId: string;
      folderLabel: string;
    };

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
 * Client orchestrator for feed subscriptions, article list state, and reader state.
 */
export function FeedsWorkspace({
  initialFeeds,
  initialFolders,
}: FeedsWorkspaceProps) {
  const router = useRouter();
  const searchInputRef = useRef<HTMLInputElement>(null);

  const [feeds, setFeeds] = useState<FeedViewModel[]>(initialFeeds);
  const [folders, setFolders] = useState<FolderViewModel[]>(initialFolders);

  const [selectedScope, setSelectedScope] = useState<SidebarScope>({ type: "all" });
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

  /** Width of the article list pane in pixels (adjustable via drag handle). */
  const [listPaneWidth, setListPaneWidth] = useState(320);
  /** Ref to track whether a resize drag is in progress (avoids re-renders). */
  const isResizingRef = useRef(false);

  const [feedUrlInput, setFeedUrlInput] = useState("");
  const [feedFolderIdInput, setFeedFolderIdInput] = useState("");
  const [folderNameInput, setFolderNameInput] = useState("");

  const [isAddingFeed, setIsAddingFeed] = useState(false);
  const [isAddingFolder, setIsAddingFolder] = useState(false);
  const [isRefreshingFeeds, setIsRefreshingFeeds] = useState(false);
  const [isApplyingAction, setIsApplyingAction] = useState(false);

  const [infoMessage, setInfoMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);

  useEffect(() => {
    setFeeds(initialFeeds);
  }, [initialFeeds]);

  useEffect(() => {
    setFolders(initialFolders);
    const currentFolderIds = new Set(initialFolders.map((folder) => folder.id));
    setExpandedFolderIds((previous) => {
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
    if (selectedScope.type === "feed") {
      const stillExists = feeds.some((feed) => feed.id === selectedScope.feedId);
      if (!stillExists) {
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

  const scopedArticles = useMemo(() => {
    if (selectedScope.type === "all") {
      return allArticles;
    }

    if (selectedScope.type === "feed") {
      return allArticles.filter((article) => article.feedId === selectedScope.feedId);
    }

    return allArticles.filter(
      (article) => feedToFolderMap.get(article.feedId) === selectedScope.folderId
    );
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

  useEffect(() => {
    if (selectedScope.type === "folder") {
      setFeedFolderIdInput(selectedScope.folderId);
      return;
    }

    if (selectedScope.type === "feed") {
      const folderId = feedToFolderMap.get(selectedScope.feedId);
      setFeedFolderIdInput(folderId || "");
      return;
    }

    setFeedFolderIdInput("");
  }, [feedToFolderMap, selectedScope]);

  useEffect(() => {
    function closeContextMenu() {
      setContextMenu(null);
    }

    window.addEventListener("click", closeContextMenu);
    window.addEventListener("scroll", closeContextMenu, true);

    return () => {
      window.removeEventListener("click", closeContextMenu);
      window.removeEventListener("scroll", closeContextMenu, true);
    };
  }, []);

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

      const response = await fetch("/api/feeds", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "item.markRead", itemId: articleId }),
      });

      if (!response.ok) {
        const body = await parseResponseJson<ApiErrorResponse>(response);
        setErrorMessage(body?.error || "Unable to persist read state.");
      }
    },
    [allArticles]
  );

  const openSelectedArticle = useCallback(
    async (articleId: string) => {
      setSelectedArticleId(articleId);
      setOpenArticleId(articleId);
      setInfoMessage(null);
      setErrorMessage(null);
      await markArticleAsRead(articleId);
    },
    [markArticleAsRead]
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

  /**
   * Starts a drag-to-resize interaction for the article list pane.
   * Uses delta-based calculation: tracks mouse offset from drag start position
   * and applies it to the starting width, clamped between 280px and 600px.
   */
  const handleListPaneResizeStart = useCallback(
    (event: MouseEvent<HTMLDivElement>) => {
      event.preventDefault();
      isResizingRef.current = true;

      const startX = event.clientX;
      const startWidth = listPaneWidth;

      /* Prevent text selection and show resize cursor during drag. */
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";

      function onMouseMove(moveEvent: globalThis.MouseEvent) {
        if (!isResizingRef.current) {
          return;
        }

        const delta = moveEvent.clientX - startX;
        const newWidth = Math.max(280, Math.min(600, startWidth + delta));
        setListPaneWidth(newWidth);
      }

      function onMouseUp() {
        isResizingRef.current = false;
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
        document.removeEventListener("mousemove", onMouseMove);
        document.removeEventListener("mouseup", onMouseUp);
      }

      document.addEventListener("mousemove", onMouseMove);
      document.addEventListener("mouseup", onMouseUp);
    },
    [listPaneWidth]
  );

  const handleRefresh = useCallback(async () => {
    if (isRefreshingFeeds) {
      return;
    }

    setIsRefreshingFeeds(true);
    setInfoMessage(null);
    setErrorMessage(null);

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

    setInfoMessage(
      addedCount > 0
        ? `Refresh complete. ${addedCount} new article${addedCount === 1 ? "" : "s"} added.`
        : "Refresh complete. No new articles this time."
    );

    setIsRefreshingFeeds(false);
    router.refresh();
  }, [isRefreshingFeeds, router]);

  const handleAddFeed = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();

      if (isAddingFeed) {
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

      const response = await fetch("/api/feeds", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "feed.create",
          url: nextUrl,
          folderId: feedFolderIdInput || null,
        }),
      });
      const body = await parseResponseJson<ApiErrorResponse>(response);

      if (!response.ok) {
        setErrorMessage(body?.error || "Could not add feed.");
        setIsAddingFeed(false);
        return;
      }

      setFeedUrlInput("");
      setInfoMessage("Feed added.");
      setIsAddingFeed(false);
      router.refresh();
    },
    [feedFolderIdInput, feedUrlInput, isAddingFeed, router]
  );

  const handleCreateFolder = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();

      if (isAddingFolder) {
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
      }

      setFolderNameInput("");
      setIsAddingFolder(false);
      setIsAddFolderFormVisible(false);
      setInfoMessage("Folder created.");
      router.refresh();
    },
    [folderNameInput, isAddingFolder, router]
  );

  const openFeedContextMenu = useCallback(
    (feedId: string, event: MouseEvent<HTMLButtonElement>) => {
      event.preventDefault();
      setContextMenu({ kind: "feed", id: feedId, x: event.clientX, y: event.clientY });
    },
    []
  );

  const openFolderContextMenu = useCallback(
    (folderId: string, event: MouseEvent<HTMLButtonElement>) => {
      event.preventDefault();
      setContextMenu({ kind: "folder", id: folderId, x: event.clientX, y: event.clientY });
    },
    []
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

  const feedLabelById = useMemo(() => {
    const map = new Map<string, string>();
    for (const feed of feeds) {
      map.set(feed.id, getFeedLabel(feed));
    }
    return map;
  }, [feeds]);

  const folderLabelById = useMemo(() => {
    const map = new Map<string, string>();
    for (const folder of folders) {
      map.set(folder.id, folder.name);
    }
    return map;
  }, [folders]);

  const statusPanel = useMemo(() => {
    const hasPanel =
      Boolean(infoMessage) ||
      Boolean(errorMessage) ||
      isAddFolderFormVisible ||
      Boolean(pendingAction);

    if (!hasPanel) {
      return null;
    }

    return (
      <div className={styles.statusPanel}>
        {infoMessage ? <p className={styles.infoMessage}>{infoMessage}</p> : null}
        {errorMessage ? <p className={styles.errorMessage}>Error: {errorMessage}</p> : null}

        {isAddFolderFormVisible ? (
          <form className={styles.inlineForm} onSubmit={handleCreateFolder}>
            <label htmlFor="new-folder-name">Folder name</label>
            <input
              id="new-folder-name"
              value={folderNameInput}
              onChange={(event) => setFolderNameInput(event.currentTarget.value)}
              placeholder="New folder"
            />
            <button type="submit" disabled={isAddingFolder}>
              {isAddingFolder ? "Creating..." : "Create Folder"}
            </button>
            <button
              type="button"
              onClick={() => setIsAddFolderFormVisible(false)}
              disabled={isAddingFolder}
            >
              Cancel
            </button>
          </form>
        ) : null}

        {pendingAction ? (
          <div className={styles.pendingAction}>
            {pendingAction.kind === "feed-delete" ? (
              <p>
                Delete feed &quot;{pendingAction.feedLabel}&quot; and all its stored
                articles?
              </p>
            ) : null}

            {pendingAction.kind === "folder-delete" ? (
              <p>
                Delete folder &quot;{pendingAction.folderLabel}&quot; and every
                feed/article inside it?
              </p>
            ) : null}

            {pendingAction.kind === "feed-rename" ? (
              <label className={styles.actionField}>
                Feed name
                <input
                  value={pendingAction.draftTitle}
                  onChange={(event) =>
                    setPendingAction((previous) =>
                      previous?.kind === "feed-rename"
                        ? { ...previous, draftTitle: event.currentTarget.value }
                        : previous
                    )
                  }
                />
              </label>
            ) : null}

            {pendingAction.kind === "folder-rename" ? (
              <label className={styles.actionField}>
                Folder name
                <input
                  value={pendingAction.draftName}
                  onChange={(event) =>
                    setPendingAction((previous) =>
                      previous?.kind === "folder-rename"
                        ? { ...previous, draftName: event.currentTarget.value }
                        : previous
                    )
                  }
                />
              </label>
            ) : null}

            {pendingAction.kind === "feed-move" ? (
              <label className={styles.actionField}>
                Move feed to folder
                <select
                  value={pendingAction.draftFolderId}
                  onChange={(event) =>
                    setPendingAction((previous) =>
                      previous?.kind === "feed-move"
                        ? { ...previous, draftFolderId: event.currentTarget.value }
                        : previous
                    )
                  }
                >
                  <option value="">Uncategorized</option>
                  {folders
                    .slice()
                    .sort((a, b) => a.name.localeCompare(b.name))
                    .map((folder) => (
                      <option key={folder.id} value={folder.id}>
                        {folder.name}
                      </option>
                    ))}
                </select>
              </label>
            ) : null}

            <div className={styles.pendingActionButtons}>
              <button type="button" onClick={applyPendingAction} disabled={isApplyingAction}>
                {isApplyingAction ? "Saving..." : "Confirm"}
              </button>
              <button
                type="button"
                onClick={cancelPendingAction}
                disabled={isApplyingAction}
              >
                Cancel
              </button>
            </div>
          </div>
        ) : null}
      </div>
    );
  }, [
    applyPendingAction,
    cancelPendingAction,
    errorMessage,
    folderNameInput,
    folders,
    handleCreateFolder,
    infoMessage,
    isAddFolderFormVisible,
    isAddingFolder,
    isApplyingAction,
    pendingAction,
  ]);

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
      setIsSidebarCollapsed((previous) => !previous);
    },
  });

  return (
    <div className={styles.workspace}>
      <Layout
        toolbar={
          <Toolbar
            query={searchQuery}
            searchInputRef={searchInputRef}
            isRefreshing={isRefreshingFeeds}
            isSidebarCollapsed={isSidebarCollapsed}
            onQueryChange={setSearchQuery}
            onRefresh={() => {
              void handleRefresh();
            }}
            onToggleSidebar={() => setIsSidebarCollapsed((previous) => !previous)}
          />
        }
        addFeedForm={
          isAddFeedFormVisible ? (
            <AddFeedForm
              folders={folders}
              url={feedUrlInput}
              folderId={feedFolderIdInput}
              isSubmitting={isAddingFeed}
              onUrlChange={setFeedUrlInput}
              onFolderIdChange={setFeedFolderIdInput}
              onSubmit={(event) => {
                void handleAddFeed(event);
              }}
            />
          ) : null
        }
        statusPanel={statusPanel}
        sidebar={
          <Sidebar
            folders={folders}
            feeds={feeds}
            expandedFolderIds={expandedFolderIds}
            selectedScope={selectedScope}
            onSelectAll={() => setSelectedScope({ type: "all" })}
            onSelectFolder={(folderId) => setSelectedScope({ type: "folder", folderId })}
            onSelectFeed={(feedId) => setSelectedScope({ type: "feed", feedId })}
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
            onOpenFolderContextMenu={openFolderContextMenu}
            onOpenFeedContextMenu={openFeedContextMenu}
            onShowAddFeedForm={() => setIsAddFeedFormVisible(true)}
            onShowAddFolderForm={() => setIsAddFolderFormVisible(true)}
          />
        }
        articleList={
          <ArticleList
            articles={visibleArticles}
            selectedArticleId={selectedArticleId}
            openArticleId={openArticleId}
            onSelectArticle={(articleId) => {
              void openSelectedArticle(articleId);
            }}
          />
        }
        articleReader={<ArticleReader article={openArticle} />}
        isSidebarCollapsed={isSidebarCollapsed}
        listPaneWidth={listPaneWidth}
        onListPaneResizeStart={handleListPaneResizeStart}
      />

      {contextMenu ? (
        <div
          className={styles.contextMenu}
          style={{ left: contextMenu.x, top: contextMenu.y }}
          role="menu"
        >
          {contextMenu.kind === "feed" ? (
            <>
              <button
                type="button"
                onClick={() => {
                  const label = feedLabelById.get(contextMenu.id) || "";
                  setPendingAction({
                    kind: "feed-rename",
                    feedId: contextMenu.id,
                    draftTitle: label,
                  });
                }}
              >
                Rename
              </button>
              <button
                type="button"
                onClick={() => {
                  const feed = feeds.find((candidate) => candidate.id === contextMenu.id);
                  setPendingAction({
                    kind: "feed-move",
                    feedId: contextMenu.id,
                    draftFolderId: feed?.folderId || "",
                  });
                }}
              >
                Move to Folder
              </button>
              <button
                type="button"
                onClick={() => {
                  setPendingAction({
                    kind: "feed-delete",
                    feedId: contextMenu.id,
                    feedLabel: feedLabelById.get(contextMenu.id) || "this feed",
                  });
                }}
              >
                Delete
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => {
                  setPendingAction({
                    kind: "folder-rename",
                    folderId: contextMenu.id,
                    draftName: folderLabelById.get(contextMenu.id) || "",
                  });
                }}
              >
                Rename
              </button>
              <button
                type="button"
                onClick={() => {
                  setPendingAction({
                    kind: "folder-delete",
                    folderId: contextMenu.id,
                    folderLabel: folderLabelById.get(contextMenu.id) || "this folder",
                  });
                }}
              >
                Delete
              </button>
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}
