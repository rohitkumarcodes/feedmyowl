/**
 * Middle-pane list showing filtered articles for the current sidebar scope.
 */

import type { RefObject } from "react";
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
  showFeedTitle: boolean;
  searchQuery: string;
  searchIsActive: boolean;
  searchTotalMatchCount: number;
  searchMaxResults: number;
  searchIsCapped: boolean;
  searchHighlightsByArticleId: Record<string, ArticleSearchHighlights>;
  searchInputRef: RefObject<HTMLInputElement | null>;
  onSearchQueryChange: (value: string) => void;
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
  showFeedTitle,
  searchQuery,
  searchIsActive,
  searchTotalMatchCount,
  searchMaxResults,
  searchIsCapped,
  searchHighlightsByArticleId,
  searchInputRef,
  onSearchQueryChange,
  onSelectArticle,
}: ArticleListProps) {
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

  return (
    <section
      className={styles.root}
      data-article-list-root
      tabIndex={-1}
    >
      <div className={styles.searchBar}>
        <label className={styles.searchLabel} htmlFor="article-search-input">
          Search all articles
        </label>
        <div className={styles.searchControls}>
          <input
            ref={searchInputRef}
            id="article-search-input"
            type="search"
            className={styles.searchInput}
            value={searchQuery}
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
          >
            Clear
          </button>
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
        <div className={styles.emptyWrap}>
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
    </section>
  );
}
