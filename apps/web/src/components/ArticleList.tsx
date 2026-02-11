/**
 * Middle-pane list showing filtered articles for the current sidebar scope.
 */

import { useEffect, useRef, type RefObject } from "react";
import { ArticleRow } from "./ArticleRow";
import type { ArticleSearchHighlights } from "./article-search";
import type { ArticleViewModel } from "./feeds-types";
import styles from "./ArticleList.module.css";

interface ArticleListProps {
  articles: ArticleViewModel[];
  selectedArticleId: string | null;
  openArticleId: string | null;
  statusMessage: string | null;
  emptyStateMessage: string;
  isInitialScopeEmpty: boolean;
  showFeedTitle: boolean;
  searchQuery: string;
  searchIsActive: boolean;
  searchTotalMatchCount: number;
  searchMaxResults: number;
  searchIsCapped: boolean;
  searchHighlightsByArticleId: Record<string, ArticleSearchHighlights>;
  paginationInitialized: boolean;
  paginationIsLoading: boolean;
  paginationHasMore: boolean;
  paginationError: string | null;
  searchInputRef: RefObject<HTMLInputElement | null>;
  onSearchQueryChange: (value: string) => void;
  onRequestLoadMore: () => void;
  onSelectArticle: (articleId: string) => void;
}

/**
 * Renders the article list and empty-state text.
 */
export function ArticleList({
  articles,
  selectedArticleId,
  openArticleId,
  statusMessage,
  emptyStateMessage,
  isInitialScopeEmpty,
  showFeedTitle,
  searchQuery,
  searchIsActive,
  searchTotalMatchCount,
  searchMaxResults,
  searchIsCapped,
  searchHighlightsByArticleId,
  paginationInitialized,
  paginationIsLoading,
  paginationHasMore,
  paginationError,
  searchInputRef,
  onSearchQueryChange,
  onRequestLoadMore,
  onSelectArticle,
}: ArticleListProps) {
  const listRootRef = useRef<HTMLElement>(null);
  const loadMoreSentinelRef = useRef<HTMLDivElement>(null);
  const normalizedQuery = searchQuery.trim();
  const hasQuery = normalizedQuery.length > 0;
  const showMinLengthHint = hasQuery && !searchIsActive;
  const isSearchEmpty = searchIsActive && searchTotalMatchCount === 0;

  const searchResultLabel = searchIsActive
    ? searchIsCapped
      ? `Showing top ${searchMaxResults} of ${searchTotalMatchCount} results for "${normalizedQuery}".`
      : `${searchTotalMatchCount} result${searchTotalMatchCount === 1 ? "" : "s"} for "${normalizedQuery}".`
    : null;

  const resolvedEmptyStateMessage = isSearchEmpty
    ? `No results for "${normalizedQuery}".`
    : emptyStateMessage;

  useEffect(() => {
    if (
      searchIsActive ||
      !paginationHasMore ||
      paginationIsLoading ||
      Boolean(paginationError)
    ) {
      return;
    }

    const root = listRootRef.current;
    const target = loadMoreSentinelRef.current;
    if (!root || !target) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          onRequestLoadMore();
        }
      },
      {
        root,
        rootMargin: "180px 0px 240px 0px",
      }
    );

    observer.observe(target);

    return () => {
      observer.disconnect();
    };
  }, [
    onRequestLoadMore,
    paginationError,
    paginationHasMore,
    paginationIsLoading,
    searchIsActive,
  ]);

  const shouldShowPaginationStatus =
    !searchIsActive &&
    paginationInitialized &&
    (paginationIsLoading || Boolean(paginationError) || paginationHasMore || articles.length > 0);

  return (
    <section
      className={styles.root}
      data-article-list-root
      tabIndex={-1}
      ref={listRootRef}
    >
      <div className={styles.searchBar}>
        <div className={styles.searchControls}>
          <div className={styles.searchInputWrap}>
            <input
              ref={searchInputRef}
              id="article-search-input"
              type="search"
              className={styles.searchInput}
              value={searchQuery}
              aria-label="Search all articles"
              placeholder="Search all articles..."
              onChange={(event) => onSearchQueryChange(event.currentTarget.value)}
              onKeyDown={(event) => {
                if (event.key !== "Escape") {
                  return;
                }

                if (searchQuery.length > 0) {
                  event.preventDefault();
                  onSearchQueryChange("");
                  return;
                }

                event.currentTarget.blur();
              }}
            />
            <button
              type="button"
              className={styles.clearButton}
              onClick={() => onSearchQueryChange("")}
              disabled={searchQuery.length === 0}
              aria-label="Clear search"
              title="Clear search"
            >
              ×
            </button>
          </div>
        </div>

        {showMinLengthHint ? (
          <p className={styles.searchHint}>Type at least 2 characters to search all articles.</p>
        ) : null}

        {searchResultLabel ? (
          <p className={styles.searchMeta} role="status" aria-live="polite">
            {searchResultLabel}
          </p>
        ) : null}
      </div>

      {statusMessage ? (
        <p className={styles.statusMessage} role="status" aria-live="polite">
          {statusMessage}
        </p>
      ) : null}

      {articles.length === 0 ? (
        <div
          className={`${styles.emptyWrap} ${isInitialScopeEmpty ? styles.emptyWrapInitial : ""}`}
        >
          <p className={styles.empty}>{resolvedEmptyStateMessage}</p>
        </div>
      ) : (
        articles.map((article) => (
          <ArticleRow
            key={article.id}
            article={article}
            isSelected={selectedArticleId === article.id}
            isOpen={openArticleId === article.id}
            showFeedTitle={showFeedTitle}
            highlights={searchHighlightsByArticleId[article.id]}
            onSelect={() => onSelectArticle(article.id)}
          />
        ))
      )}

      {shouldShowPaginationStatus ? (
        <div className={styles.paginationStatus}>
          {paginationError ? (
            <div className={styles.paginationError} role="status" aria-live="polite">
              <p>{paginationError}</p>
              <button
                type="button"
                className={styles.paginationRetry}
                onClick={onRequestLoadMore}
                disabled={paginationIsLoading}
              >
                Retry
              </button>
            </div>
          ) : paginationIsLoading ? (
            <p className={styles.paginationHint} role="status" aria-live="polite">
              Loading more articles...
            </p>
          ) : paginationHasMore ? (
            <div
              ref={loadMoreSentinelRef}
              className={styles.paginationSentinel}
              aria-hidden="true"
            >
              Scroll to load more articles.
            </div>
          ) : articles.length > 0 ? (
            <p className={styles.paginationHint}>You&apos;re all caught up.</p>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
