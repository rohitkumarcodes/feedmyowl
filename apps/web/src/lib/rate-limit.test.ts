import type { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { applyRouteRateLimit } from "@/lib/rate-limit";

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
  it("fails open when redis is not configured", async () => {
    const decision = await applyRouteRateLimit({
      request: toRequest(),
      routeKey: "api_feeds_post",
      userId: "user_123",
      userLimitPerMinute: 20,
      ipLimitPerMinute: 60,
    });

    expect(decision.allowed).toBe(true);
  });
});
