/**
 * One row in the middle-pane article list.
 */

import type { ArticleViewModel } from "./feeds-types";
import styles from "./ArticleRow.module.css";

interface ArticleRowProps {
  article: ArticleViewModel;
  isSelected: boolean;
  isOpen: boolean;
  showFeedTitle: boolean;
  onSelect: () => void;
}

/**
 * Renders a single article row — title only, with optional feed name.
 */
export function ArticleRow({
  article,
  isSelected,
  isOpen,
  showFeedTitle,
  onSelect,
}: ArticleRowProps) {
  const isRead = Boolean(article.readAt);

  return (
    <button
      type="button"
      className={`${styles.row} ${isSelected ? styles.rowSelected : ""}`}
      data-article-id={article.id}
      onClick={onSelect}
      aria-pressed={isOpen}
      aria-current={isOpen ? "true" : undefined}
    >
      <p className={`${styles.title} ${isRead ? styles.titleRead : ""}`}>{article.title}</p>
      {showFeedTitle ? (
        <p className={styles.meta}>{article.feedTitle}</p>
      ) : null}
    </button>
  );
}
