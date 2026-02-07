"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArticleList } from "./ArticleList";
import { ArticleReader } from "./ArticleReader";
import { Layout } from "./Layout";
import { Sidebar, SidebarScope } from "./Sidebar";
import { Toolbar } from "./Toolbar";
import type { ArticleViewModel, FeedViewModel } from "./feeds-types";
import { extractArticleSnippet } from "@/utils/articleText";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { loadWorkspaceSnapshot, saveWorkspaceSnapshot } from "@/lib/offline-cache";
import styles from "./feeds-workspace.module.css";

interface FeedsWorkspaceProps {
  initialFeeds: FeedViewModel[];
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
 * Client orchestrator for feed subscriptions, article list state, and reader state.
 */
export function FeedsWorkspace({ initialFeeds }: FeedsWorkspaceProps) {
  const router = useRouter();
  const requestedExtractionIds = useRef<Set<string>>(new Set());

  const [feeds, setFeeds] = useState<FeedViewModel[]>(initialFeeds);

  const [selectedScope, setSelectedScope] = useState<SidebarScope>({ type: "all" });
  const [selectedArticleId, setSelectedArticleId] = useState<string | null>(null);
  const [openArticleId, setOpenArticleId] = useState<string | null>(null);

  const [isAddFeedFormVisible, setIsAddFeedFormVisible] = useState(false);
  const [feedUrlInput, setFeedUrlInput] = useState("");

  const [isAddingFeed, setIsAddingFeed] = useState(false);
  const [isRefreshingFeeds, setIsRefreshingFeeds] = useState(false);
  const [deletingFeedId, setDeletingFeedId] = useState<string | null>(null);

  const [infoMessage, setInfoMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [networkMessage, setNetworkMessage] = useState<string | null>(null);
  const [liveMessage, setLiveMessage] = useState("");

  const [isMobile, setIsMobile] = useState(false);
  const [mobileView, setMobileView] = useState<"feeds" | "articles" | "reader">(
    "feeds"
  );

  useEffect(() => {
    setFeeds(initialFeeds);
  }, [initialFeeds]);

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
    }).catch(() => {
      // Snapshot cache failures should not interrupt reading flow.
    });
  }, [feeds]);

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
      setNetworkMessage(
        "Could not connect to the server. Previously loaded data remains available."
      );

    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);

    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  useEffect(() => {
    if (selectedScope.type !== "feed") {
      return;
    }

    const stillExists = feeds.some((feed) => feed.id === selectedScope.feedId);
    if (!stillExists) {
      setSelectedScope({ type: "all" });
    }
  }, [feeds, selectedScope]);

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

  const visibleArticles = useMemo(() => {
    if (selectedScope.type === "feed") {
      return allArticles.filter((article) => article.feedId === selectedScope.feedId);
    }

    return allArticles;
  }, [allArticles, selectedScope]);

  const openArticle = useMemo(
    () => allArticles.find((article) => article.id === openArticleId) || null,
    [allArticles, openArticleId]
  );

  const selectedScopeLabel = useMemo(() => {
    if (selectedScope.type === "all") {
      return "All articles";
    }

    const feed = feeds.find((candidate) => candidate.id === selectedScope.feedId);
    return feed ? getFeedLabel(feed) : "Articles";
  }, [feeds, selectedScope]);

  const listStatusMessage = useMemo(() => {
    if (selectedScope.type === "feed") {
      const feed = feeds.find((candidate) => candidate.id === selectedScope.feedId);
      return feed?.lastFetchErrorMessage || null;
    }

    const erroredFeed = feeds.find(
      (feed) => feed.lastFetchStatus === "error" && feed.lastFetchErrorMessage
    );
    return erroredFeed?.lastFetchErrorMessage || null;
  }, [feeds, selectedScope]);

  const emptyStateMessage = useMemo(() => {
    if (feeds.length === 0) {
      return "Add a feed to get started.";
    }

    if (selectedScope.type === "feed") {
      return "No articles in this feed.";
    }

    return "No articles yet. Refresh to load the latest posts.";
  }, [feeds.length, selectedScope]);

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
    [feedUrlInput, isAddingFeed, isMobile, router, setMobileViewWithHistory]
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
    [deletingFeedId, router]
  );

  const handleDismissMessage = useCallback(() => {
    setInfoMessage(null);
    setErrorMessage(null);
  }, []);

  const handleShowAddFeedForm = useCallback(() => {
    setIsAddFeedFormVisible(true);
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
              isRefreshing={isRefreshingFeeds}
              onRefresh={() => {
                void handleRefresh();
              }}
            />
            {networkMessage ? <p className={styles.toolbarMessage}>{networkMessage}</p> : null}
          </div>
        }
        sidebar={
          <Sidebar
            feeds={feeds}
            selectedScope={selectedScope}
            onSelectAll={() => handleSelectScope({ type: "all" })}
            onSelectFeed={(feedId) => handleSelectScope({ type: "feed", feedId })}
            isAddFeedFormVisible={isAddFeedFormVisible}
            feedUrlInput={feedUrlInput}
            isAddingFeed={isAddingFeed}
            onShowAddFeedForm={handleShowAddFeedForm}
            onCancelAddFeed={() => setIsAddFeedFormVisible(false)}
            onFeedUrlChange={setFeedUrlInput}
            onSubmitFeed={(event) => {
              void handleAddFeed(event);
            }}
            infoMessage={infoMessage}
            errorMessage={errorMessage}
            onDismissMessage={handleDismissMessage}
            deletingFeedId={deletingFeedId}
            onRequestFeedDelete={(feedId, feedLabel) => {
              void handleDeleteFeed(feedId, feedLabel);
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
