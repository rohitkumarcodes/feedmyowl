import type { ApiErrorBody } from "@/contracts/api/common";

export type UiActionContext =
  | "article.mark_read"
  | "article.mark_all_read"
  | "article.set_saved"
  | "feed.add"
  | "feed.discover"
  | "feed.refresh"
  | "feed.delete"
  | "feed.rename"
  | "feed.set_folders"
  | "folder.create"
  | "folder.rename"
  | "folder.delete"
  | "uncategorized.delete"
  | "uncategorized.move"
  | "settings.theme"
  | "settings.reading_mode"
  | "settings.owl"
  | "settings.import"
  | "settings.export"
  | "account.delete";

export interface UiMappedFailureMessage {
  severity: "error" | "warning";
  title: string;
  text: string;
  dedupeKey: string;
  retryAfterSeconds?: number;
  recommendedActionLabel?: "Retry" | "Choose folder" | "Open existing feed";
}

export interface MapApiFailureMessageInput {
  context: UiActionContext;
  status: number;
  networkError: boolean;
  body?: Partial<ApiErrorBody> | null;
  fallbackMessage: string;
  retryAfterHeader?: string | null;
}

export interface ApiCallFailureResultLike {
  status: number;
  networkError: boolean;
  body: Partial<ApiErrorBody> | null;
  headers?: Headers | null;
}

function parseRetryAfterSeconds(value: string | null | undefined): number | null {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const seconds = Number.parseInt(trimmed, 10);
  if (Number.isFinite(seconds) && seconds > 0) {
    return seconds;
  }

  const absolute = Date.parse(trimmed);
  if (!Number.isFinite(absolute)) {
    return null;
  }

  const deltaSeconds = Math.ceil((absolute - Date.now()) / 1000);
  return deltaSeconds > 0 ? deltaSeconds : null;
}

function contextDefaultMessage(context: UiActionContext): string {
  if (context === "feed.add") {
    return "We couldn't add this feed right now. Try again.";
  }

  if (context === "feed.refresh") {
    return "Refresh didn't finish. Try again.";
  }

  if (context === "settings.import") {
    return "Import couldn't be completed right now. Try again.";
  }

  if (context === "settings.export") {
    return "Export couldn't be completed right now. Try again.";
  }

  if (context === "account.delete") {
    return "Account deletion couldn't be completed right now. Try again.";
  }

  return "This action couldn't be completed right now. Try again.";
}

function resolveCodeMessage(
  code: string | undefined,
  context: UiActionContext,
  retryAfterSeconds: number | null,
): Omit<UiMappedFailureMessage, "dedupeKey"> | null {
  if (code === "rate_limited") {
    const delayText =
      retryAfterSeconds && retryAfterSeconds > 0
        ? ` in ${retryAfterSeconds} second${retryAfterSeconds === 1 ? "" : "s"}`
        : "";

    return {
      severity: "warning",
      title: "Too many requests",
      text: `Too many requests. Try again${delayText}.`,
      retryAfterSeconds: retryAfterSeconds ?? undefined,
      recommendedActionLabel: "Retry",
    };
  }

  if (code === "invalid_url" || code === "invalid_xml" || code === "http_404") {
    return {
      severity: "error",
      title: "Feed not found",
      text: "No feed found at this URL. Try the site's feed link.",
      recommendedActionLabel: "Open existing feed",
    };
  }

  if (code === "invalid_folder_id" || code === "invalid_folder_ids") {
    return {
      severity: "error",
      title: "Folder unavailable",
      text: "The selected folder is no longer available. Choose a folder and try again.",
      recommendedActionLabel: "Choose folder",
    };
  }

  if (code === "csrf_validation_failed") {
    return {
      severity: "error",
      title: "Session expired",
      text: "Your session expired for this action. Refresh the page and try again.",
      recommendedActionLabel: "Retry",
    };
  }

  if (code === "reserved_name") {
    return {
      severity: "error",
      title: "Name unavailable",
      text: "That name is reserved. Choose a different name and try again.",
    };
  }

  if (code === "duplicate_name") {
    return {
      severity: "warning",
      title: "Name already exists",
      text: "A folder with that name already exists. Use another name and try again.",
    };
  }

  if (code === "folder_limit_reached") {
    return {
      severity: "warning",
      title: "Folder limit reached",
      text: "You've reached the folder limit. Delete a folder and try again.",
    };
  }

  if (code === "payload_too_large") {
    return {
      severity: "warning",
      title: "File too large",
      text: "This file is too large to process. Use a smaller file and try again.",
    };
  }

  if (code === "entry_limit_exceeded" && context === "settings.import") {
    return {
      severity: "warning",
      title: "Too many entries",
      text: "This import includes too many entries. Split it into smaller files and try again.",
    };
  }

  return null;
}

/**
 * Normalize API/network failures into consistent, user-facing UI messages.
 */
export function mapApiFailureToUiMessage({
  context,
  status,
  networkError,
  body,
  fallbackMessage,
  retryAfterHeader,
}: MapApiFailureMessageInput): UiMappedFailureMessage {
  const code = typeof body?.code === "string" ? body.code : undefined;
  const bodyRetryAfter =
    typeof body?.retryAfterSeconds === "number" && body.retryAfterSeconds > 0
      ? body.retryAfterSeconds
      : null;
  const headerRetryAfter = parseRetryAfterSeconds(retryAfterHeader);
  const retryAfterSeconds = bodyRetryAfter ?? headerRetryAfter;

  if (networkError) {
    return {
      severity: "error",
      title: "Connection issue",
      text: "Couldn't reach FeedMyOwl. Check your connection and try again.",
      dedupeKey: `${context}:network`,
      recommendedActionLabel: "Retry",
    };
  }

  const codeMessage = resolveCodeMessage(code, context, retryAfterSeconds);
  if (codeMessage) {
    return {
      ...codeMessage,
      dedupeKey: `${context}:${code}`,
    };
  }

  if (status === 401 || status === 403) {
    return {
      severity: "error",
      title: "Session issue",
      text: "Your session no longer has access to this action. Refresh and try again.",
      dedupeKey: `${context}:session:${status}`,
      recommendedActionLabel: "Retry",
    };
  }

  if (status === 404) {
    if (context === "feed.delete" || context === "feed.rename" || context === "feed.set_folders") {
      return {
        severity: "warning",
        title: "Feed not found",
        text: "That feed is no longer available. Refresh and try again.",
        dedupeKey: `${context}:not_found`,
        recommendedActionLabel: "Retry",
      };
    }

    if (
      context === "folder.create" ||
      context === "folder.rename" ||
      context === "folder.delete"
    ) {
      return {
        severity: "warning",
        title: "Folder not found",
        text: "That folder is no longer available. Refresh and try again.",
        dedupeKey: `${context}:not_found`,
        recommendedActionLabel: "Retry",
      };
    }

    if (
      context === "article.mark_read" ||
      context === "article.mark_all_read" ||
      context === "article.set_saved"
    ) {
      return {
        severity: "warning",
        title: "Article not found",
        text: "That article is no longer available. Refresh and try again.",
        dedupeKey: `${context}:not_found`,
        recommendedActionLabel: "Retry",
      };
    }

    return {
      severity: "warning",
      title: "Not found",
      text: "This item is no longer available. Refresh and try again.",
      dedupeKey: `${context}:not_found`,
      recommendedActionLabel: "Retry",
    };
  }

  const message = body?.error || fallbackMessage || contextDefaultMessage(context);
  const hint = typeof body?.hint === "string" && body.hint.trim() ? body.hint.trim() : null;

  return {
    severity: "error",
    title: "Action not completed",
    text: hint ? `${message} ${hint}` : message,
    dedupeKey: `${context}:status:${status || 0}`,
  };
}

export function mapApiCallResultToUiMessage(
  result: ApiCallFailureResultLike,
  context: UiActionContext,
  fallbackMessage: string,
): UiMappedFailureMessage {
  return mapApiFailureToUiMessage({
    context,
    status: result.status,
    networkError: result.networkError,
    body: result.body,
    fallbackMessage,
    retryAfterHeader: result.headers?.get("Retry-After") ?? null,
  });
}
