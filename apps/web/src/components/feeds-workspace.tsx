"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArticleList } from "./ArticleList";
import { ArticleReader } from "./ArticleReader";
import { Layout } from "./Layout";
import { Sidebar, SidebarScope } from "./Sidebar";
import type { FeedViewModel } from "./feeds-types";
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
}

/**
 * Client orchestrator for feed subscriptions, article list state, and reader state.
 */
export function FeedsWorkspace({ initialFeeds }: FeedsWorkspaceProps) {
  const router = useRouter();

  const [feeds, setFeeds] = useState<FeedViewModel[]>(initialFeeds);
  const [selectedScope, setSelectedScope] = useState<SidebarScope>({ type: "none" });
  const [selectedArticleId, setSelectedArticleId] = useState<string | null>(null);
  const [openArticleId, setOpenArticleId] = useState<string | null>(null);
  const [liveMessage, setLiveMessage] = useState("");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  useEffect(() => {
    setFeeds(initialFeeds);
  }, [initialFeeds]);

  /* Sync sidebar collapsed state to a data attribute on <html> so the
     fixed-position brand logo (rendered in the server-side auth layout)
     can be hidden via a pure CSS selector. */
  useEffect(() => {
    document.documentElement.setAttribute(
      "data-sidebar-collapsed",
      String(sidebarCollapsed)
    );
  }, [sidebarCollapsed]);

  const {
    isMobile,
    mobileView,
    setMobileViewWithHistory,
    onMobileBackToFeeds,
    onMobileBackToArticles,
  } = useFeedsWorkspaceMobile();

  const { setNetworkMessage } = useFeedsWorkspaceNetwork({
    feeds,
    setFeeds,
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
    () => selectScopeLabel(feeds, selectedScope),
    [feeds, selectedScope]
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
  } = useFeedsWorkspaceActions({
    allArticles,
    isMobile,
    router,
    setLiveMessage,
    setFeeds,
    setSelectedScope,
    setMobileViewWithHistory,
    setNetworkMessage,
  });

  useEffect(() => {
    if (selectedScope.type !== "feed") {
      return;
    }

    const stillExists = feeds.some((feed) => feed.id === selectedScope.feedId);
    if (!stillExists) {
      setSelectedScope({ type: "all" });
    }
  }, [feeds, selectedScope]);

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
            selectedScope={selectedScope}
            onSelectAll={() => handleSelectScope({ type: "all" })}
            onSelectFeed={(feedId) => handleSelectScope({ type: "feed", feedId })}
            isAddFeedFormVisible={isAddFeedFormVisible}
            feedUrlInput={feedUrlInput}
            isAddingFeed={isAddingFeed}
            isRefreshingFeeds={isRefreshingFeeds}
            onShowAddFeedForm={showAddFeedForm}
            onRefresh={() => {
              void handleRefresh();
            }}
            onCancelAddFeed={cancelAddFeedForm}
            onFeedUrlChange={setFeedUrlInput}
            onSubmitFeed={(event) => {
              void handleAddFeed(event);
            }}
            infoMessage={infoMessage}
            errorMessage={errorMessage}
            onDismissMessage={clearStatusMessages}
            deletingFeedId={deletingFeedId}
            onRequestFeedDelete={(feedId) => {
              void handleDeleteFeed(feedId);
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
            showFeedTitle={selectedScope.type === "all"}
            onSelectArticle={(articleId) => {
              void openSelectedArticle(articleId);
            }}
          />
        }
        articleReader={<ArticleReader article={openArticle} />}
        sidebarCollapsed={sidebarCollapsed}
        onToggleSidebar={() => setSidebarCollapsed((prev) => !prev)}
        isMobile={isMobile}
        mobileView={mobileView}
        mobileListTitle={selectedScopeLabel}
        onMobileBackToFeeds={onMobileBackToFeeds}
        onMobileBackToArticles={onMobileBackToArticles}
      />
    </div>
  );
}
