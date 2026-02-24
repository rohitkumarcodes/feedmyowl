import type { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  captureError: vi.fn(),
}));

vi.mock("@/lib/server/error-tracking", () => ({
  captureError: mocks.captureError,
}));

import { GET } from "@/app/api/cron/upstash-heartbeat/route";

const fetchMock = vi.fn();

function createRequest(authorization?: string): NextRequest {
  const headers = authorization
    ? {
        authorization,
      }
    : undefined;

  return new Request("https://app.feedmyowl.test/api/cron/upstash-heartbeat", {
    method: "GET",
    headers,
  }) as NextRequest;
}

describe("GET /api/cron/upstash-heartbeat", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockReset();
    mocks.captureError.mockReset();

    delete process.env.CRON_SECRET;
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns 401 when request is missing a valid cron secret", async () => {
    process.env.CRON_SECRET = "cron_secret";

    const response = await GET(createRequest());
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error).toBe("Unauthorized");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns 500 when redis env vars are missing", async () => {
    process.env.CRON_SECRET = "cron_secret";

    const response = await GET(createRequest("Bearer cron_secret"));
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.error).toBe("Upstash Redis is not configured");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("sets a heartbeat key with ttl when configured", async () => {
    process.env.CRON_SECRET = "cron_secret";
    process.env.UPSTASH_REDIS_REST_URL = "https://example.upstash.io";
    process.env.UPSTASH_REDIS_REST_TOKEN = "upstash_token";
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ result: "OK" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );

    const response = await GET(createRequest("Bearer cron_secret"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.key).toBe("system:upstash:heartbeat");
    expect(body.ttlSeconds).toBe(1209600);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [calledUrl, calledOptions] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(calledUrl).toContain(
      "https://example.upstash.io/set/system%3Aupstash%3Aheartbeat/",
    );
    expect(calledUrl).toContain("/EX/1209600");
    expect(calledOptions).toMatchObject({
      method: "POST",
      cache: "no-store",
      headers: {
        Authorization: "Bearer upstash_token",
      },
    });
  });

  it("returns 502 and captures error when Upstash returns an error payload", async () => {
    process.env.CRON_SECRET = "cron_secret";
    process.env.UPSTASH_REDIS_REST_URL = "https://example.upstash.io";
    process.env.UPSTASH_REDIS_REST_TOKEN = "upstash_token";
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ error: "ERR broken" }), {
        status: 500,
        headers: { "content-type": "application/json" },
      }),
    );

    const response = await GET(createRequest("Bearer cron_secret"));
    const body = await response.json();

    expect(response.status).toBe(502);
    expect(body.error).toBe("Heartbeat failed");
    expect(mocks.captureError).toHaveBeenCalledTimes(1);
  });
});
