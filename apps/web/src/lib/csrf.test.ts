import type { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { assertTrustedWriteOrigin } from "@/lib/csrf";

function toRequest(headers: Record<string, string>): NextRequest {
  return new Request("https://app.feedmyowl.test/api/feeds", {
    method: "POST",
    headers,
    body: JSON.stringify({ ok: true }),
  }) as NextRequest;
}

describe("assertTrustedWriteOrigin", () => {
  it("allows trusted origin", () => {
    const result = assertTrustedWriteOrigin(
      toRequest({
        "content-type": "application/json",
        origin: "https://app.feedmyowl.com",
      }),
      "api.feeds.post"
    );

    expect(result).toBeNull();
  });

  it("allows trusted referer fallback when origin is missing", () => {
    const result = assertTrustedWriteOrigin(
      toRequest({
        "content-type": "application/json",
        referer: "https://app.feedmyowl.com/settings",
      }),
      "api.feeds.post"
    );

    expect(result).toBeNull();
  });

  it("rejects untrusted origin", async () => {
    const response = assertTrustedWriteOrigin(
      toRequest({
        "content-type": "application/json",
        origin: "https://evil.example",
      }),
      "api.feeds.post"
    );

    expect(response).not.toBeNull();
    const body = await response?.json();
    expect(response?.status).toBe(403);
    expect(body?.code).toBe("csrf_validation_failed");
  });

  it("rejects missing origin and referer", async () => {
    const response = assertTrustedWriteOrigin(
      toRequest({
        "content-type": "application/json",
      }),
      "api.feeds.post"
    );

    expect(response).not.toBeNull();
    const body = await response?.json();
    expect(response?.status).toBe(403);
    expect(body?.code).toBe("csrf_validation_failed");
  });
});
