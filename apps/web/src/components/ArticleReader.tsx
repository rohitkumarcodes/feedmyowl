/**
 * Right-pane reader rendering selected article content with sanitized HTML.
 */

import { useEffect, useMemo, useRef } from "react";
import DOMPurify from "dompurify";
import { toRenderableHtml } from "@/utils/articleText";
import type { ArticleViewModel } from "./feeds-types";
import styles from "./ArticleReader.module.css";

interface ArticleReaderProps {
  article: ArticleViewModel | null;
  onRequestExtraction?: (articleId: string) => void;
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
  }).format(parsed);
}

function isTrustedEmbedSource(url: string): boolean {
  try {
    const parsed = new URL(url);
    const hostname = parsed.hostname.toLowerCase();

    return (
      hostname === "youtube.com" ||
      hostname.endsWith(".youtube.com") ||
      hostname === "youtu.be" ||
      hostname === "vimeo.com" ||
      hostname.endsWith(".vimeo.com")
    );
  } catch {
    return false;
  }
}

/**
 * Renders either a placeholder or the selected article reader view.
 */
export function ArticleReader({ article, onRequestExtraction }: ArticleReaderProps) {
  const bodyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!article || !onRequestExtraction) {
      return;
    }

    if (article.extractedHtml || article.extractionStatus === "fallback") {
      return;
    }

    if (!article.link) {
      return;
    }

    onRequestExtraction(article.id);
  }, [article, onRequestExtraction]);

  const sanitizedHtml = useMemo(() => {
    if (!article) {
      return "";
    }

    const preferredHtml = article.extractedHtml || toRenderableHtml(article.content);

    return DOMPurify.sanitize(preferredHtml, {
      FORBID_TAGS: ["script", "style"],
      FORBID_ATTR: ["style", "onerror", "onload", "onclick", "onmouseover"],
    });
  }, [article]);

  useEffect(() => {
    const root = bodyRef.current;
    if (!root) {
      return;
    }

    const teardownCallbacks: Array<() => void> = [];

    const images = root.querySelectorAll("img");
    for (const image of images) {
      if (!image.hasAttribute("alt")) {
        image.setAttribute("alt", "");
      }

      const onError = () => {
        const placeholder = document.createElement("div");
        placeholder.className = styles.imagePlaceholder;
        placeholder.setAttribute("role", "img");
        placeholder.setAttribute("aria-label", "Image could not be loaded");
        placeholder.textContent = "Image could not be loaded.";
        image.replaceWith(placeholder);
      };

      image.addEventListener("error", onError, { once: true });
      teardownCallbacks.push(() => image.removeEventListener("error", onError));
    }

    const iframes = root.querySelectorAll("iframe");
    for (const iframe of iframes) {
      const src = iframe.getAttribute("src") || "";
      if (!isTrustedEmbedSource(src)) {
        iframe.remove();
        continue;
      }

      iframe.setAttribute("loading", "lazy");
      iframe.setAttribute("referrerpolicy", "no-referrer");
      iframe.classList.add(styles.safeEmbed);
    }

    const audios = root.querySelectorAll("audio");
    for (const audio of audios) {
      audio.setAttribute("controls", "");
      audio.removeAttribute("autoplay");
      audio.classList.add(styles.mediaElement);
    }

    const videos = root.querySelectorAll("video");
    for (const video of videos) {
      video.setAttribute("controls", "");
      video.removeAttribute("autoplay");
      video.classList.add(styles.mediaElement);
    }

    return () => {
      for (const teardown of teardownCallbacks) {
        teardown();
      }
    };
  }, [sanitizedHtml]);

  if (!article) {
    return (
      <div className={styles.emptyWrap} role="main" aria-label="Article reader">
        <p className={styles.emptyText}>Select an article to read.</p>
      </div>
    );
  }

  return (
    <div className={styles.root} role="main" aria-label="Article reader">
      <article className={styles.content}>
        <p className={styles.feedName}>{article.feedTitle}</p>
        <h1 className={styles.title} id="reader-article-title" tabIndex={-1}>
          {article.title}
        </h1>
        <p className={styles.meta}>
          {article.author || "Unknown author"} · {formatPublicationDate(article.publishedAt || article.createdAt)}
        </p>
        <div
          ref={bodyRef}
          className={styles.body}
          dangerouslySetInnerHTML={{ __html: sanitizedHtml }}
        />
        {article.link ? (
          <a
            href={article.link}
            target="_blank"
            rel="noreferrer"
            className={styles.link}
            aria-label={`Open original article on ${article.feedTitle}`}
          >
            Open original ↗
          </a>
        ) : null}
      </article>
    </div>
  );
}
