/**
 * One row in the middle-pane article list.
 */

import type { ReactNode } from "react";
import type { ArticleSearchHighlights, MatchRange } from "./article-search";
import type { ArticleViewModel } from "./feeds-types";
import styles from "./ArticleRow.module.css";

interface ArticleRowProps {
  article: ArticleViewModel;
  isSelected: boolean;
  isOpen: boolean;
  showFeedTitle: boolean;
  highlights?: ArticleSearchHighlights;
  onSelect: () => void;
}

function normalizeHighlightRanges(
  text: string,
  ranges: MatchRange[] | undefined
): MatchRange[] {
  if (!ranges || ranges.length === 0 || text.length === 0) {
    return [];
  }

  return ranges
    .map((range) => ({
      start: Math.max(0, Math.min(range.start, text.length - 1)),
      end: Math.max(0, Math.min(range.end, text.length - 1)),
    }))
    .filter((range) => range.end >= range.start);
}

function renderHighlightedText(text: string, ranges: MatchRange[] | undefined): ReactNode {
  const normalizedRanges = normalizeHighlightRanges(text, ranges);

  if (normalizedRanges.length === 0) {
    return text;
  }

  const pieces: ReactNode[] = [];
  let cursor = 0;

  for (let index = 0; index < normalizedRanges.length; index += 1) {
    const range = normalizedRanges[index];

    if (cursor < range.start) {
      pieces.push(text.slice(cursor, range.start));
    }

    pieces.push(
      <mark key={`${range.start}-${range.end}-${index}`} className={styles.match}>
        {text.slice(range.start, range.end + 1)}
      </mark>
    );
    cursor = range.end + 1;
  }

  if (cursor < text.length) {
    pieces.push(text.slice(cursor));
  }

  return pieces;
}

/**
 * Renders a single article row — title only, with optional feed name.
 */
export function ArticleRow({
  article,
  isSelected,
  isOpen,
  showFeedTitle,
  highlights,
  onSelect,
}: ArticleRowProps) {
  const isRead = Boolean(article.readAt);

  return (
    <button
      type="button"
      className={`${styles.row} ${isSelected ? styles.rowSelected : ""}`}
      data-article-id={article.id}
      onClick={onSelect}
      aria-current={isOpen ? "true" : undefined}
    >
      <p className={`${styles.title} ${isRead ? styles.titleRead : ""}`}>
        <span className={styles.dot}>●</span>
        {renderHighlightedText(article.title, highlights?.title)}
      </p>
      {showFeedTitle ? (
        <p className={styles.meta}>{renderHighlightedText(article.feedTitle, highlights?.feedTitle)}</p>
      ) : null}
    </button>
  );
}
