export type FeedErrorContext = "create" | "refresh";

export interface NormalizedFeedError {
  code: "http_404" | "timeout" | "invalid_xml" | "network" | "unreachable";
  message: string;
}

function resolveFeedErrorCode(error: unknown): NormalizedFeedError["code"] {
  const rawMessage =
    error instanceof Error ? error.message.toLowerCase() : "unknown error";

  if (rawMessage.includes("404")) {
    return "http_404";
  }

  if (rawMessage.includes("timed out") || rawMessage.includes("timeout")) {
    return "timeout";
  }

  if (
    rawMessage.includes("xml") ||
    rawMessage.includes("rss") ||
    rawMessage.includes("atom") ||
    rawMessage.includes("not valid")
  ) {
    return "invalid_xml";
  }

  if (rawMessage.includes("fetch") || rawMessage.includes("network")) {
    return "network";
  }

  return "unreachable";
}

function resolveFeedErrorMessage(
  code: NormalizedFeedError["code"],
  context: FeedErrorContext
): string {
  if (context === "create") {
    if (code === "http_404") {
      return "This feed could not be reached. The server returned a 404, which usually means the feed URL changed.";
    }

    if (code === "timeout") {
      return "This feed could not be updated. The server did not respond in time. This is often temporary.";
    }

    if (code === "invalid_xml") {
      return "This URL does not appear to be a valid RSS or Atom feed.";
    }

    return "Could not reach this URL. Check the address and try again.";
  }

  if (code === "http_404") {
    return "This feed could not be reached. The server returned a 404, which usually means the feed URL changed or no longer exists.";
  }

  if (code === "timeout") {
    return "This feed could not be updated. The server did not respond in time. This is usually temporary.";
  }

  if (code === "invalid_xml") {
    return "This feed returned content that is not valid RSS or Atom XML.";
  }

  if (code === "network") {
    return "This feed could not be updated because the network request failed.";
  }

  return "This feed could not be updated right now.";
}

/**
 * Translate parser/network failures into stable codes and calm user messages.
 */
export function normalizeFeedError(
  error: unknown,
  context: FeedErrorContext
): NormalizedFeedError {
  const code = resolveFeedErrorCode(error);
  const message = resolveFeedErrorMessage(code, context);
  return { code, message };
}
