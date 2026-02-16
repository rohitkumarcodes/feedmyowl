import { describe, expect, it } from "vitest";
import {
  mapApiCallResultToUiMessage,
  mapApiFailureToUiMessage,
} from "@/lib/shared/ui-messages";

describe("ui-messages", () => {
  it("maps network failures to a consistent connection message", () => {
    const mapped = mapApiFailureToUiMessage({
      context: "feed.refresh",
      status: 0,
      networkError: true,
      body: null,
      fallbackMessage: "Refresh failed.",
    });

    expect(mapped).toMatchObject({
      severity: "error",
      title: "Connection issue",
      text: "Couldn't reach FeedMyOwl. Check your connection and try again.",
      dedupeKey: "feed.refresh:network",
    });
  });

  it("maps rate-limited failures with retry guidance", () => {
    const headers = new Headers({ "Retry-After": "7" });
    const mapped = mapApiCallResultToUiMessage(
      {
        status: 429,
        networkError: false,
        body: {
          error: "Rate limit exceeded. Please wait before trying again.",
          code: "rate_limited",
        },
        headers,
      },
      "feed.add",
      "We couldn't add this feed right now. Try again.",
    );

    expect(mapped).toMatchObject({
      severity: "warning",
      title: "Too many requests",
      text: "Too many requests. Try again in 7 seconds.",
      dedupeKey: "feed.add:rate_limited",
      recommendedActionLabel: "Retry",
      retryAfterSeconds: 7,
    });
  });

  it("maps invalid feed errors to actionable feed guidance", () => {
    const mapped = mapApiFailureToUiMessage({
      context: "feed.add",
      status: 400,
      networkError: false,
      body: {
        error: "This URL does not appear to be a valid RSS or Atom feed.",
        code: "invalid_xml",
      },
      fallbackMessage: "Couldn't add feed.",
    });

    expect(mapped).toMatchObject({
      severity: "error",
      title: "Feed not found",
      text: "No feed found at this URL. Try the site's feed link.",
      dedupeKey: "feed.add:invalid_xml",
      recommendedActionLabel: "Open existing feed",
    });
  });
});
