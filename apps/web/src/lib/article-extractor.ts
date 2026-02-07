/**
 * Module Boundary: Full-Article Extraction
 *
 * This file is the only place that imports the extraction dependency.
 * If we replace extraction providers later, only this module should change.
 */

import Parser from "@postlight/parser";

/** Result shape returned to API routes and UI orchestration logic. */
export interface ArticleExtractionResult {
  status: "success" | "failed";
  source: string;
  html: string | null;
  title: string | null;
  byline: string | null;
  errorCode?: string;
  errorMessage?: string;
}

/**
 * Convert unknown runtime errors into a stable extraction error payload.
 */
function toExtractionError(error: unknown): {
  errorCode: string;
  errorMessage: string;
} {
  if (error instanceof Error) {
    const message = error.message.trim();
    if (!message) {
      return { errorCode: "extract_unknown", errorMessage: "Extraction failed." };
    }

    return {
      errorCode: "extract_failed",
      errorMessage: message,
    };
  }

  return { errorCode: "extract_unknown", errorMessage: "Extraction failed." };
}

/**
 * Attempt full-article extraction for a public article URL.
 */
export async function extractArticleFromUrl(
  url: string
): Promise<ArticleExtractionResult> {
  try {
    const extracted = await Parser.parse(url, {
      contentType: "html",
    });

    const html = extracted?.content?.trim() || "";
    if (!html) {
      return {
        status: "failed",
        source: "postlight",
        html: null,
        title: extracted?.title?.trim() || null,
        byline: extracted?.author?.trim() || null,
        errorCode: "extract_empty",
        errorMessage: "Extractor returned no readable content.",
      };
    }

    return {
      status: "success",
      source: "postlight",
      html,
      title: extracted?.title?.trim() || null,
      byline: extracted?.author?.trim() || null,
    };
  } catch (error) {
    const normalized = toExtractionError(error);
    return {
      status: "failed",
      source: "postlight",
      html: null,
      title: null,
      byline: null,
      errorCode: normalized.errorCode,
      errorMessage: normalized.errorMessage,
    };
  }
}
