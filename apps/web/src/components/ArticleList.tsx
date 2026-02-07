/**
 * Middle-pane list showing filtered articles for the current sidebar scope.
 */

import { ArticleRow } from "./ArticleRow";
import type { ArticleViewModel } from "./feeds-types";
import styles from "./ArticleList.module.css";

interface ArticleListProps {
  articles: ArticleViewModel[];
  selectedArticleId: string | null;
  openArticleId: string | null;
  statusMessage: string | null;
  emptyStateMessage: string;
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
  onSelectArticle,
}: ArticleListProps) {
  return (
    <section
      className={styles.root}
      data-article-list-root
      role="region"
      aria-label="Article list"
      tabIndex={-1}
    >
      {statusMessage ? (
        <p className={styles.statusMessage} role="status" aria-live="polite">
          {statusMessage}
        </p>
      ) : null}

      {articles.length === 0 ? (
        <p className={styles.empty}>{emptyStateMessage}</p>
      ) : (
        articles.map((article) => (
          <ArticleRow
            key={article.id}
            article={article}
            isSelected={selectedArticleId === article.id}
            isOpen={openArticleId === article.id}
            onSelect={() => onSelectArticle(article.id)}
          />
        ))
      )}
    </section>
  );
}
