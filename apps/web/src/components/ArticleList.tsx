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
  onSelectArticle: (articleId: string) => void;
}

/**
 * Renders the article list and empty-state text.
 */
export function ArticleList({
  articles,
  selectedArticleId,
  openArticleId,
  onSelectArticle,
}: ArticleListProps) {
  return (
    <div className={styles.root}>
      {articles.length === 0 ? (
        <p className={styles.empty}>No articles match this view.</p>
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
    </div>
  );
}
