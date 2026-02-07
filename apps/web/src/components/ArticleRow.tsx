/**
 * One row in the middle-pane article list.
 */

import { timeAgo } from "@/utils/timeAgo";
import type { ArticleViewModel } from "./feeds-types";
import styles from "./ArticleRow.module.css";

interface ArticleRowProps {
  article: ArticleViewModel;
  isSelected: boolean;
  isOpen: boolean;
  onSelect: () => void;
}

/**
 * Renders title, source/time metadata, and snippet for a single article.
 */
export function ArticleRow({
  article,
  isSelected,
  isOpen,
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
      <p className={styles.meta}>
        {article.feedTitle} · {timeAgo(article.publishedAt || article.createdAt)}
      </p>
      <p className={styles.snippet}>{article.snippet}</p>
    </button>
  );
}
