import type { NextRequest } from "next/server";
import { beforeEach, describe, expect, it } from "vitest";
import {
  __resetInMemoryRateLimitStateForTests,
  applyRouteRateLimit,
} from "@/lib/server/rate-limit";

function toRequest(): NextRequest {
  return new Request("https://app.feedmyowl.test/api/feeds", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin: "https://app.feedmyowl.com",
    },
    body: JSON.stringify({ action: "feed.discover" }),
  }) as NextRequest;
}

describe("applyRouteRateLimit", () => {
  beforeEach(() => {
    __resetInMemoryRateLimitStateForTests();
  });

  it("enforces limits with in-memory fallback when redis is not configured", async () => {
    const firstDecision = await applyRouteRateLimit({
      request: toRequest(),
      routeKey: "api_feeds_post",
      userId: "user_123",
      userLimitPerMinute: 1,
      ipLimitPerMinute: 10,
    });
    const secondDecision = await applyRouteRateLimit({
      request: toRequest(),
      routeKey: "api_feeds_post",
      userId: "user_123",
      userLimitPerMinute: 1,
      ipLimitPerMinute: 10,
    });

    expect(firstDecision.allowed).toBe(true);
    expect(secondDecision.allowed).toBe(false);

    if (!secondDecision.allowed) {
      expect(secondDecision.response.status).toBe(429);
      expect(secondDecision.response.headers.get("Retry-After")).toBeTruthy();
    }
  });
});
