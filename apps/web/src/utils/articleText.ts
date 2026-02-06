/**
 * Utility helpers for deriving snippets and safe renderable HTML from feed content.
 */

const EMPTY_ARTICLE_MESSAGE = "No readable content available for this article.";

function decodeCommonEntities(value: string): string {
  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'");
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Converts stored HTML/plain content into normalized plain text.
 */
export function stripHtmlToText(content: string | null): string {
  if (!content) {
    return EMPTY_ARTICLE_MESSAGE;
  }

  const plainText = decodeCommonEntities(
    content
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<\/?(p|div|section|article|h[1-6]|blockquote|pre)\b[^>]*>/gi, "\n")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<li\b[^>]*>/gi, "\n- ")
      .replace(/<\/li>/gi, "")
      .replace(/<[^>]+>/g, " ")
  )
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();

  return plainText || EMPTY_ARTICLE_MESSAGE;
}

/**
 * Produces a single-line snippet used in article rows and search matching.
 */
export function extractArticleSnippet(
  content: string | null,
  maxLength = 160
): string {
  const baseText = stripHtmlToText(content).replace(/\s+/g, " ").trim();

  if (baseText.length <= maxLength) {
    return baseText;
  }

  return `${baseText.slice(0, maxLength - 3)}...`;
}

/**
 * Produces HTML for reader rendering. Plain text is escaped and wrapped in <p> tags.
 */
export function toRenderableHtml(content: string | null): string {
  if (!content || !content.trim()) {
    return `<p>${EMPTY_ARTICLE_MESSAGE}</p>`;
  }

  const trimmed = content.trim();
  const appearsToBeHtml = /<\/?[a-z][\s\S]*>/i.test(trimmed);

  if (appearsToBeHtml) {
    return trimmed;
  }

  const escaped = escapeHtml(trimmed)
    .replace(/\r\n?/g, "\n")
    .replace(/\n\n+/g, "</p><p>")
    .replace(/\n/g, "<br />");

  return `<p>${escaped}</p>`;
}
