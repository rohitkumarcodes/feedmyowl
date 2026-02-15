/**
 * One row in the middle-pane article list.
 */

import type { ReactNode } from "react";
import type {
  ArticleSearchHighlights,
  HiddenMatchSource,
  MatchRange,
} from "@/features/feeds/state/article-search";
import type { ArticleViewModel } from "@/features/feeds/types/view-models";
import type { ReadingMode } from "@/lib/shared/reading-mode";
import styles from "./ArticleRow.module.css";

interface ArticleRowProps {
  article: ArticleViewModel;
  isSelected: boolean;
  isOpen: boolean;
  showFeedTitle: boolean;
  /** Current reading mode — controls whether read/unread styling is applied. */
  readingMode: ReadingMode;
  highlights?: ArticleSearchHighlights;
  onSelect: () => void;
}

function normalizeHighlightRanges(
  text: string,
  ranges: MatchRange[] | undefined,
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

function renderHighlightedText(
  text: string,
  ranges: MatchRange[] | undefined,
): ReactNode {
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
      </mark>,
    );
    cursor = range.end + 1;
  }

  if (cursor < text.length) {
    pieces.push(text.slice(cursor));
  }

  return pieces;
}

function formatHiddenSourceLabel(
  hiddenSources: HiddenMatchSource[] | undefined,
): string | null {
  if (!hiddenSources || hiddenSources.length === 0) {
    return null;
  }

  if (hiddenSources.length === 2) {
    return "Matched in snippet and author";
  }

  return hiddenSources[0] === "snippet" ? "Matched in snippet" : "Matched in author";
}

/**
 * Renders a single article row — title only, with optional feed name.
 */
export function ArticleRow({
  article,
  isSelected,
  isOpen,
  showFeedTitle,
  readingMode,
  highlights,
  onSelect,
}: ArticleRowProps) {
  /**
   * In reader mode all titles look the same — no visual read/unread distinction.
   * In checker mode read articles are dimmed so unread articles stand out.
   */
  const showReadState = readingMode === "checker";
  const isRead = showReadState && Boolean(article.readAt);
  const hiddenSourceLabel = formatHiddenSourceLabel(highlights?.hiddenSources);

  return (
    <button
      type="button"
      className={`${styles.row} ${isSelected ? styles.rowSelected : ""}`}
      data-article-id={article.id}
      onClick={onSelect}
      aria-current={isOpen ? "true" : undefined}
    >
      <p className={`${styles.title} ${isRead ? styles.titleRead : ""}`}>
        {renderHighlightedText(article.title, highlights?.title)}
      </p>
      {showFeedTitle ? (
        <p className={styles.meta}>
          {renderHighlightedText(article.feedTitle, highlights?.feedTitle)}
        </p>
      ) : null}
      {hiddenSourceLabel ? (
        <p className={styles.matchSource}>{hiddenSourceLabel}</p>
      ) : null}
    </button>
  );
}
