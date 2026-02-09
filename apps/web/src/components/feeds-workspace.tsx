"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArticleList } from "./ArticleList";
import { ArticleReader } from "./ArticleReader";
import { Layout } from "./Layout";
import { Sidebar, SidebarScope } from "./Sidebar";
import type { FeedViewModel, FolderViewModel } from "./feeds-types";
import {
  selectAllArticles,
  selectEmptyStateMessage,
  selectListStatusMessage,
  selectOpenArticle,
  selectScopeLabel,
  selectVisibleArticles,
} from "./feeds-workspace.selectors";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { useFeedsWorkspaceActions } from "@/hooks/useFeedsWorkspaceActions";
import { useFeedsWorkspaceMobile } from "@/hooks/useFeedsWorkspaceMobile";
import { useFeedsWorkspaceNetwork } from "@/hooks/useFeedsWorkspaceNetwork";
import styles from "./feeds-workspace.module.css";

interface FeedsWorkspaceProps {
  initialFeeds: FeedViewModel[];
  initialFolders: FolderViewModel[];
}

/**
 * Client orchestrator for feed subscriptions, article list state, and reader state.
 */
export function FeedsWorkspace({ initialFeeds, initialFolders }: FeedsWorkspaceProps) {
  const router = useRouter();

  const [feeds, setFeeds] = useState<FeedViewModel[]>(initialFeeds);
  const [folders, setFolders] = useState<FolderViewModel[]>(initialFolders);
  const [selectedScope, setSelectedScope] = useState<SidebarScope>({ type: "none" });
  const [selectedArticleId, setSelectedArticleId] = useState<string | null>(null);
  const [openArticleId, setOpenArticleId] = useState<string | null>(null);
  const [liveMessage, setLiveMessage] = useState("");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [listCollapsed, setListCollapsed] = useState(false);

  useEffect(() => {
    setFeeds(initialFeeds);
  }, [initialFeeds]);

  useEffect(() => {
    setFolders(initialFolders);
  }, [initialFolders]);

  /* Sync collapsed states to data attributes on <html> so the
     fixed-position brand logo (rendered in the server-side auth layout)
     can be hidden via a pure CSS selector. */
  useEffect(() => {
    document.documentElement.setAttribute(
      "data-sidebar-collapsed",
      String(sidebarCollapsed)
    );
  }, [sidebarCollapsed]);

  useEffect(() => {
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

  const { setNetworkMessage } = useFeedsWorkspaceNetwork({
    feeds,
    folders,
    setFeeds,
    setFolders,
  });

  const allArticles = useMemo(() => selectAllArticles(feeds), [feeds]);

  const visibleArticles = useMemo(
    () => selectVisibleArticles(allArticles, selectedScope),
    [allArticles, selectedScope]
  );

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

  const {
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
    setAddFeedInputMode,
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

  const openSelectedArticle = useCallback(
    async (articleId: string) => {
      setSelectedArticleId(articleId);
      setOpenArticleId(articleId);
      clearStatusMessages();
      await markArticleAsRead(articleId);
      focusReaderTitle();

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

  const moveSelectionBy = useCallback(
    (step: number) => {
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
            addFeedInputMode={addFeedInputMode}
            addFeedStage={addFeedStage}
            addFeedProgressMessage={addFeedProgressMessage}
            feedUrlInput={feedUrlInput}
            bulkFeedUrlInput={bulkFeedUrlInput}
            inlineDuplicateMessage={inlineDuplicateMessage}
            addFeedFolderIds={addFeedFolderIds}
            addFeedNewFolderNameInput={addFeedNewFolderNameInput}
            discoveryCandidates={discoveryCandidates}
            selectedDiscoveryCandidateUrl={selectedDiscoveryCandidateUrl}
            bulkAddResultRows={bulkAddResultRows}
            bulkAddSummary={bulkAddSummary}
            showAddAnotherAction={showAddAnotherAction}
            isAddingFeed={isAddingFeed}
            isRefreshingFeeds={isRefreshingFeeds}
            isCreatingFolder={isCreatingFolder}
            onShowAddFeedForm={showAddFeedForm}
            onRefresh={() => {
              void handleRefresh();
            }}
            onCancelAddFeed={cancelAddFeedForm}
            onAddFeedInputModeChange={setAddFeedInputMode}
            onFeedUrlChange={setFeedUrlInput}
            onBulkFeedUrlChange={setBulkFeedUrlInput}
            onToggleAddFeedFolder={toggleAddFeedFolder}
            onAddFeedNewFolderNameChange={setAddFeedNewFolderNameInput}
            onSelectDiscoveryCandidate={selectDiscoveryCandidate}
            onCreateFolderFromAddFeed={() => {
              void createFolderFromAddFeed();
            }}
            onAddAnother={handleAddAnother}
            onSubmitFeed={(event) => {
              void handleAddFeed(event);
            }}
            infoMessage={infoMessage}
            errorMessage={errorMessage}
            onDismissMessage={clearStatusMessages}
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
            onCreateFolder={(name) => {
              return createFolderFromSidebar(name);
            }}
            onRequestFolderRename={(folderId, name) => {
              return handleRenameFolder(folderId, name);
            }}
            onRequestFolderDelete={(folderId, mode) => {
              return handleDeleteFolder(folderId, mode);
            }}
            onCollapse={() => setSidebarCollapsed(true)}
          />
        }
        articleList={
          <ArticleList
            articles={visibleArticles}
            selectedArticleId={selectedArticleId}
            openArticleId={openArticleId}
            statusMessage={listStatusMessage}
            emptyStateMessage={emptyStateMessage}
            showFeedTitle={selectedScope.type !== "feed"}
            onSelectArticle={(articleId) => {
              void openSelectedArticle(articleId);
            }}
          />
        }
        articleReader={<ArticleReader article={openArticle} />}
        sidebarCollapsed={sidebarCollapsed}
        onToggleSidebar={() => setSidebarCollapsed((prev) => !prev)}
        listCollapsed={listCollapsed}
        onCollapseList={() => setListCollapsed(true)}
        onToggleList={() => setListCollapsed((prev) => !prev)}
        isMobile={isMobile}
        mobileView={mobileView}
        mobileListTitle={selectedScopeLabel}
        onMobileBackToFeeds={onMobileBackToFeeds}
        onMobileBackToArticles={onMobileBackToArticles}
      />
    </div>
  );
}
