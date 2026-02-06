"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import styles from "./feeds-workspace.module.css";

export interface FeedItemViewModel {
  id: string;
  title: string | null;
  link: string | null;
  content: string | null;
  author: string | null;
  publishedAt: string | null;
  createdAt: string;
}

export interface FeedViewModel {
  id: string;
  title: string | null;
  description: string | null;
  url: string;
  lastFetchedAt: string | null;
  createdAt: string;
  items: FeedItemViewModel[];
}

interface FeedsWorkspaceProps {
  initialFeeds: FeedViewModel[];
  subscriptionTier: string;
  freeFeedLimit: number;
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

interface FlattenedArticle {
  id: string;
  title: string;
  link: string | null;
  content: string | null;
  author: string | null;
  publishedAt: string | null;
  createdAt: string;
  feedId: string;
  feedTitle: string;
}

const MAX_VISIBLE_ARTICLES = 80;

function getFeedLabel(feed: FeedViewModel): string {
  return feed.title || extractHost(feed.url);
}

function extractHost(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function stripHtml(text: string): string {
  return text
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function getExcerpt(content: string | null): string {
  if (!content) {
    return "No preview available yet.";
  }
  const cleanText = stripHtml(content);
  if (cleanText.length <= 180) {
    return cleanText;
  }
  return `${cleanText.slice(0, 177)}...`;
}

function toTimeValue(iso: string | null): number {
  if (!iso) {
    return 0;
  }
  const parsed = Date.parse(iso);
  return Number.isNaN(parsed) ? 0 : parsed;
}

function formatDateTime(iso: string | null): string {
  if (!iso) {
    return "Never";
  }
  const date = new Date(iso);
  if (Number.isNaN(date.valueOf())) {
    return "Unknown";
  }
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

async function parseResponseJson<T>(response: Response): Promise<T | null> {
  try {
    return (await response.json()) as T;
  } catch {
    return null;
  }
}

export function FeedsWorkspace({
  initialFeeds,
  subscriptionTier,
  freeFeedLimit,
}: FeedsWorkspaceProps) {
  const router = useRouter();
  const [feeds, setFeeds] = useState<FeedViewModel[]>(initialFeeds);
  const [feedUrlInput, setFeedUrlInput] = useState("");
  const [query, setQuery] = useState("");
  const [activeFeedId, setActiveFeedId] = useState<string>("all");
  const [infoMessage, setInfoMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isAddingFeed, setIsAddingFeed] = useState(false);
  const [isRefreshingFeeds, setIsRefreshingFeeds] = useState(false);
  const [removingFeedId, setRemovingFeedId] = useState<string | null>(null);

  useEffect(() => {
    setFeeds(initialFeeds);
  }, [initialFeeds]);

  useEffect(() => {
    if (activeFeedId === "all") {
      return;
    }
    const selectedFeedStillExists = feeds.some((feed) => feed.id === activeFeedId);
    if (!selectedFeedStillExists) {
      setActiveFeedId("all");
    }
  }, [activeFeedId, feeds]);

  const usageCount = feeds.length;
  const usagePercent =
    subscriptionTier === "free"
      ? Math.min(100, Math.round((usageCount / freeFeedLimit) * 100))
      : 0;

  const totalArticleCount = useMemo(
    () => feeds.reduce((count, feed) => count + feed.items.length, 0),
    [feeds]
  );

  const lastFetchedAt = useMemo(() => {
    let latest = 0;
    for (const feed of feeds) {
      const value = toTimeValue(feed.lastFetchedAt);
      if (value > latest) {
        latest = value;
      }
    }
    return latest > 0 ? new Date(latest).toISOString() : null;
  }, [feeds]);

  const articles = useMemo(() => {
    const flattened = feeds.flatMap((feed) =>
      feed.items.map(
        (item): FlattenedArticle => ({
          id: item.id,
          title: item.title || "Untitled article",
          link: item.link,
          content: item.content,
          author: item.author,
          publishedAt: item.publishedAt,
          createdAt: item.createdAt,
          feedId: feed.id,
          feedTitle: getFeedLabel(feed),
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

  const filteredArticles = useMemo(() => {
    const loweredQuery = query.trim().toLowerCase();
    return articles
      .filter((article) =>
        activeFeedId === "all" ? true : article.feedId === activeFeedId
      )
      .filter((article) => {
        if (!loweredQuery) {
          return true;
        }
        const haystack = `${article.title} ${article.feedTitle} ${article.content || ""}`
          .toLowerCase()
          .trim();
        return haystack.includes(loweredQuery);
      })
      .slice(0, MAX_VISIBLE_ARTICLES);
  }, [activeFeedId, articles, query]);

  async function handleAddFeed(event: FormEvent<HTMLFormElement>) {
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
    setErrorMessage(null);
    setInfoMessage(null);

    const response = await fetch("/api/feeds", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: nextUrl }),
    });
    const body = await parseResponseJson<ApiErrorResponse>(response);

    if (!response.ok) {
      setErrorMessage(body?.error || "Could not add feed.");
      setIsAddingFeed(false);
      return;
    }

    setFeedUrlInput("");
    setInfoMessage("Feed added. Fetching latest data...");
    setIsAddingFeed(false);
    router.refresh();
  }

  async function handleRefresh() {
    if (isRefreshingFeeds) {
      return;
    }

    setIsRefreshingFeeds(true);
    setErrorMessage(null);
    setInfoMessage(null);

    const response = await fetch("/api/refresh", { method: "POST" });
    const body = await parseResponseJson<RefreshResponse & ApiErrorResponse>(
      response
    );

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
    setInfoMessage(
      addedCount > 0
        ? `Refresh complete. ${addedCount} new article${addedCount === 1 ? "" : "s"} added.`
        : "Refresh complete. No new articles this time."
    );
    setIsRefreshingFeeds(false);
    router.refresh();
  }

  async function handleRemoveFeed(feedId: string, feedLabel: string) {
    if (removingFeedId) {
      return;
    }

    const shouldDelete = window.confirm(
      `Remove "${feedLabel}" and all stored articles from this feed?`
    );
    if (!shouldDelete) {
      return;
    }

    setRemovingFeedId(feedId);
    setErrorMessage(null);
    setInfoMessage(null);

    const response = await fetch(`/api/feeds/${feedId}`, { method: "DELETE" });
    const body = await parseResponseJson<ApiErrorResponse>(response);

    if (!response.ok) {
      setErrorMessage(body?.error || "Could not remove feed.");
      setRemovingFeedId(null);
      return;
    }

    setInfoMessage("Feed removed.");
    setRemovingFeedId(null);
    router.refresh();
  }

  return (
    <div className={styles.root}>
      <section className={styles.hero}>
        <p className={styles.eyebrow}>Your Reading Desk</p>
        <h1 className={styles.heroTitle}>Track what matters, ignore the noise.</h1>
        <p className={styles.heroText}>
          Add feeds, refresh on demand, and browse a clean stream of the latest
          articles from your subscriptions.
        </p>
        <div className={styles.statGrid}>
          <article className={styles.statCard}>
            <p className={styles.statLabel}>Subscribed feeds</p>
            <p className={styles.statValue}>{usageCount}</p>
          </article>
          <article className={styles.statCard}>
            <p className={styles.statLabel}>Saved articles</p>
            <p className={styles.statValue}>{totalArticleCount}</p>
          </article>
          <article className={styles.statCard}>
            <p className={styles.statLabel}>Last refresh</p>
            <p className={styles.statValueSmall}>{formatDateTime(lastFetchedAt)}</p>
          </article>
        </div>
      </section>

      <section className={styles.panel}>
        <div className={styles.panelHeader}>
          <h2 className={styles.panelTitle}>Manage subscriptions</h2>
          <button
            type="button"
            onClick={handleRefresh}
            className={styles.secondaryButton}
            disabled={isRefreshingFeeds}
          >
            {isRefreshingFeeds ? "Refreshing..." : "Refresh all feeds"}
          </button>
        </div>
        <form onSubmit={handleAddFeed} className={styles.formRow}>
          <input
            name="feed-url"
            type="url"
            required
            placeholder="https://example.com/rss.xml"
            value={feedUrlInput}
            onChange={(event) => setFeedUrlInput(event.currentTarget.value)}
            className={styles.urlInput}
            aria-label="Feed URL"
          />
          <button
            type="submit"
            className={styles.primaryButton}
            disabled={isAddingFeed}
          >
            {isAddingFeed ? "Adding..." : "Add feed"}
          </button>
        </form>
        {subscriptionTier === "free" ? (
          <div className={styles.usageWrap} aria-live="polite">
            <div className={styles.usageMeta}>
              <span>
                Free plan usage: {usageCount}/{freeFeedLimit} feeds
              </span>
              <span>{usagePercent}%</span>
            </div>
            <div className={styles.usageBar}>
              <span className={styles.usageFill} style={{ width: `${usagePercent}%` }} />
            </div>
          </div>
        ) : null}
        {infoMessage ? <p className={styles.infoMessage}>{infoMessage}</p> : null}
        {errorMessage ? <p className={styles.errorMessage}>{errorMessage}</p> : null}
      </section>

      <section className={styles.contentGrid}>
        <div className={styles.column}>
          <header className={styles.columnHeader}>
            <h2>Feed list</h2>
            <p>{feeds.length} connected</p>
          </header>
          <div className={styles.filterRow}>
            <button
              type="button"
              onClick={() => setActiveFeedId("all")}
              className={`${styles.filterButton} ${
                activeFeedId === "all" ? styles.filterButtonActive : ""
              }`}
            >
              All feeds
            </button>
            {feeds.map((feed) => (
              <button
                key={feed.id}
                type="button"
                onClick={() => setActiveFeedId(feed.id)}
                className={`${styles.filterButton} ${
                  activeFeedId === feed.id ? styles.filterButtonActive : ""
                }`}
              >
                {getFeedLabel(feed)}
              </button>
            ))}
          </div>
          <div className={styles.feedList}>
            {feeds.length === 0 ? (
              <p className={styles.emptyState}>
                No feeds yet. Add your first RSS/Atom URL to start building your reading
                stream.
              </p>
            ) : (
              feeds.map((feed) => {
                const feedLabel = getFeedLabel(feed);
                return (
                  <article key={feed.id} className={styles.feedCard}>
                    <div className={styles.feedCardTop}>
                      <h3>{feedLabel}</h3>
                      <button
                        type="button"
                        className={styles.dangerButton}
                        onClick={() => handleRemoveFeed(feed.id, feedLabel)}
                        disabled={removingFeedId === feed.id}
                      >
                        {removingFeedId === feed.id ? "Removing..." : "Remove"}
                      </button>
                    </div>
                    <p className={styles.feedUrl}>{feed.url}</p>
                    <p className={styles.feedMeta}>
                      {feed.items.length} article{feed.items.length === 1 ? "" : "s"} stored
                      <span>•</span>
                      Updated {formatDateTime(feed.lastFetchedAt)}
                    </p>
                    {feed.description ? (
                      <p className={styles.feedDescription}>{feed.description}</p>
                    ) : null}
                  </article>
                );
              })
            )}
          </div>
        </div>

        <div className={styles.column}>
          <header className={styles.columnHeader}>
            <h2>Article stream</h2>
            <p>{filteredArticles.length} shown</p>
          </header>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.currentTarget.value)}
            placeholder="Search by title or keyword"
            className={styles.searchInput}
            aria-label="Search articles"
          />
          <div className={styles.articleList}>
            {filteredArticles.length === 0 ? (
              <p className={styles.emptyState}>
                No matching articles yet. Refresh your feeds or widen your search.
              </p>
            ) : (
              filteredArticles.map((article) => (
                <article key={article.id} className={styles.articleCard}>
                  <div className={styles.articleTop}>
                    <span className={styles.articleFeed}>{article.feedTitle}</span>
                    <span className={styles.articleTime}>
                      {formatDateTime(article.publishedAt || article.createdAt)}
                    </span>
                  </div>
                  <h3 className={styles.articleTitle}>{article.title}</h3>
                  <p className={styles.articleMeta}>
                    {article.author || "Unknown author"}
                  </p>
                  <p className={styles.articleExcerpt}>{getExcerpt(article.content)}</p>
                  {article.link ? (
                    <a
                      href={article.link}
                      target="_blank"
                      rel="noreferrer"
                      className={styles.articleLink}
                    >
                      Open source article
                    </a>
                  ) : (
                    <span className={styles.noLink}>No external link available</span>
                  )}
                </article>
              ))
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
