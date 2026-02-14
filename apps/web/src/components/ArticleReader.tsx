/**
 * Right-pane reader rendering selected article content with sanitized HTML.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import DOMPurify from "dompurify";
import { ARTICLE_SANITIZE_CONFIG } from "@/lib/article-sanitize-config";
import { extractYouTubeVideoId } from "@/lib/youtube";
import { toRenderableHtml } from "@/utils/articleText";
import type { ArticleViewModel } from "./feeds-types";
import { shouldFocusReaderRoot } from "./article-reader-focus";
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
  }).format(parsed);
}

function isTrustedEmbedSource(url: string): boolean {
  try {
    const parsed = new URL(url);
    const hostname = parsed.hostname.toLowerCase();

    return (
      hostname === "youtube.com" ||
      hostname.endsWith(".youtube.com") ||
      hostname === "youtube-nocookie.com" ||
      hostname.endsWith(".youtube-nocookie.com") ||
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
export function ArticleReader({ article }: ArticleReaderProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);

  const youtubeVideoId = useMemo(() => {
    if (!article?.link) {
      return null;
    }

    return extractYouTubeVideoId(article.link);
  }, [article?.link]);

  const [isYouTubeEmbedLoaded, setIsYouTubeEmbedLoaded] = useState(false);

  useEffect(() => {
    setIsYouTubeEmbedLoaded(false);
  }, [article?.id, youtubeVideoId]);

  const sanitizedHtml = useMemo(() => {
    if (!article) {
      return "";
    }

    if (youtubeVideoId && (!article.content || !article.content.trim())) {
      return "";
    }

    return DOMPurify.sanitize(toRenderableHtml(article.content), ARTICLE_SANITIZE_CONFIG);
  }, [article, youtubeVideoId]);

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
      iframe.setAttribute("referrerpolicy", "strict-origin-when-cross-origin");
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

  const handlePointerDownCapture = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (!shouldFocusReaderRoot(event.target)) {
        return;
      }

      rootRef.current?.focus();
    },
    []
  );

  if (!article) {
    return (
      <div
        ref={rootRef}
        className={styles.emptyWrap}
        data-article-reader-root
        tabIndex={-1}
        onPointerDownCapture={handlePointerDownCapture}
      >
        <p className={styles.emptyText}>Select an article to read.</p>
      </div>
    );
  }

  return (
    <div
      ref={rootRef}
      className={styles.root}
      data-article-reader-root
      tabIndex={-1}
      onPointerDownCapture={handlePointerDownCapture}
    >
      <article className={styles.content}>
        <p className={styles.feedName}>{article.feedTitle}</p>
        {article.link ? (
          <a
            href={article.link}
            target="_blank"
            rel="noreferrer"
            className={styles.titleLink}
          >
            <h1 className={styles.title} id="reader-article-title" tabIndex={-1}>
              {article.title}
            </h1>
          </a>
        ) : (
          <h1 className={styles.title} id="reader-article-title" tabIndex={-1}>
            {article.title}
          </h1>
        )}
        <p className={styles.meta}>
          {article.author || "Unknown author"} · {formatPublicationDate(article.publishedAt || article.createdAt)}
        </p>
        {youtubeVideoId ? (
          isYouTubeEmbedLoaded ? (
            <iframe
              className={styles.videoFrame}
              src={`https://www.youtube-nocookie.com/embed/${youtubeVideoId}`}
              title="YouTube video"
              loading="lazy"
              referrerPolicy="strict-origin-when-cross-origin"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
            />
          ) : (
            <div className={styles.videoPlaceholder}>
              <button
                type="button"
                className={styles.videoButton}
                onClick={() => setIsYouTubeEmbedLoaded(true)}
              >
                Load video
              </button>
            </div>
          )
        ) : null}
        <div
          ref={bodyRef}
          className={styles.body}
          data-article-reader-body
          dangerouslySetInnerHTML={{ __html: sanitizedHtml }}
        />
      </article>
    </div>
  );
}
