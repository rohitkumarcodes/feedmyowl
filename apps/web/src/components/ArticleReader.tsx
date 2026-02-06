/**
 * Right-pane reader rendering selected article content with sanitized HTML.
 */

import { useMemo } from "react";
import DOMPurify from "dompurify";
import { toRenderableHtml } from "@/utils/articleText";
import type { ArticleViewModel } from "./feeds-types";
import styles from "./ArticleReader.module.css";

interface ArticleReaderProps {
  article: ArticleViewModel | null;
}

function formatPublicationDate(iso: string | null): string {
  if (!iso) {
    return "Unknown publication date";
  }

  const parsed = new Date(iso);
  if (Number.isNaN(parsed.valueOf())) {
    return "Unknown publication date";
  }

  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(parsed);
}

/**
 * Renders either a placeholder or the selected article reader view.
 */
export function ArticleReader({ article }: ArticleReaderProps) {
  const sanitizedHtml = useMemo(() => {
    if (!article) {
      return "";
    }

    return DOMPurify.sanitize(toRenderableHtml(article.content));
  }, [article]);

  if (!article) {
    return (
      <div className={styles.emptyWrap}>
        <p className={styles.emptyText}>Select an article to read</p>
      </div>
    );
  }

  return (
    <div className={styles.root}>
      <article className={styles.content}>
        <p className={styles.feedName}>{article.feedTitle}</p>
        <h1 className={styles.title}>{article.title}</h1>
        <p className={styles.meta}>
          {article.author || "Unknown author"} · {formatPublicationDate(article.publishedAt || article.createdAt)}
        </p>
        <div
          className={styles.body}
          dangerouslySetInnerHTML={{ __html: sanitizedHtml }}
        />
        {article.link ? (
          <a href={article.link} target="_blank" rel="noreferrer" className={styles.link}>
            Open original ↗
          </a>
        ) : null}
      </article>
    </div>
  );
}
