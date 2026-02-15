import type { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { encodeArticleCursor } from "@/lib/shared/article-pagination";

const mocks = vi.hoisted(() => ({
  requireAuth: vi.fn(),
  ensureUserRecord: vi.fn(),
  listArticlePageForUser: vi.fn(),
}));

vi.mock("@/lib/server/auth", () => ({
  requireAuth: mocks.requireAuth,
  isAuthRequiredError: vi.fn(() => false),
}));

vi.mock("@/lib/server/app-user", () => ({
  ensureUserRecord: mocks.ensureUserRecord,
}));

vi.mock("@/lib/server/article-service", () => ({
  listArticlePageForUser: mocks.listArticlePageForUser,
}));

import { GET } from "@/app/api/articles/route";

function buildRequest(query: string): NextRequest {
  const url = `https://app.feedmyowl.test/api/articles?${query}`;
  const request = new Request(url, {
    method: "GET",
  }) as NextRequest;

  Object.defineProperty(request, "nextUrl", {
    value: new URL(url),
    configurable: true,
  });

  return request;
}

describe("GET /api/articles", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAuth.mockResolvedValue({ clerkId: "clerk_123" });
    mocks.ensureUserRecord.mockResolvedValue({ id: "user_123", clerkId: "clerk_123" });
  });

  it("returns a paged response body for a valid request", async () => {
    mocks.listArticlePageForUser.mockResolvedValue({
      status: "ok",
      items: [
        {
          id: "item_1",
          feedId: "feed_1",
          title: "One",
          link: "https://example.com/1",
          content: "<p>One</p>",
          author: "Author",
          publishedAt: new Date("2026-02-11T10:00:00.000Z"),
          readAt: null,
          savedAt: null,
          createdAt: new Date("2026-02-11T10:00:00.000Z"),
        },
      ],
      nextCursor: "next_cursor",
      hasMore: true,
      limit: 40,
      scope: { type: "all" },
    });

    const response = await GET(buildRequest("scopeType=all"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      items: [
        {
          id: "item_1",
          feedId: "feed_1",
          title: "One",
          link: "https://example.com/1",
          content: "<p>One</p>",
          author: "Author",
          publishedAt: "2026-02-11T10:00:00.000Z",
          readAt: null,
          savedAt: null,
          createdAt: "2026-02-11T10:00:00.000Z",
        },
      ],
      nextCursor: "next_cursor",
      hasMore: true,
      limit: 40,
      scope: { type: "all" },
    });
  });

  it("passes decoded cursor payload to the article service", async () => {
    const cursor = encodeArticleCursor({
      v: 1,
      sortKeyIso: "2026-02-11T12:00:00.000Z",
      itemId: "item_10",
    });

    mocks.listArticlePageForUser.mockResolvedValue({
      status: "ok",
      items: [],
      nextCursor: null,
      hasMore: false,
      limit: 20,
      scope: { type: "feed", id: "feed_123" },
    });

    const response = await GET(
      buildRequest(`scopeType=feed&scopeId=feed_123&limit=20&cursor=${cursor}`),
    );
    expect(response.status).toBe(200);
    expect(mocks.listArticlePageForUser).toHaveBeenCalledWith(
      expect.objectContaining({
        cursor: {
          v: 1,
          sortKeyIso: "2026-02-11T12:00:00.000Z",
          itemId: "item_10",
        },
        scope: { type: "feed", id: "feed_123" },
        limit: 20,
      }),
    );
  });

  it("returns 400 for invalid scope, limit, or cursor values", async () => {
    const invalidScopeResponse = await GET(buildRequest("scopeType=broken"));
    expect(invalidScopeResponse.status).toBe(400);

    const missingScopeIdResponse = await GET(buildRequest("scopeType=folder"));
    expect(missingScopeIdResponse.status).toBe(400);

    const invalidLimitResponse = await GET(buildRequest("scopeType=all&limit=0"));
    expect(invalidLimitResponse.status).toBe(400);

    const invalidCursorResponse = await GET(buildRequest("scopeType=all&cursor=%%%"));
    expect(invalidCursorResponse.status).toBe(400);
  });

  it("returns 404 for missing feed/folder scope targets", async () => {
    mocks.listArticlePageForUser.mockResolvedValue({ status: "scope_not_found" });

    const folderResponse = await GET(buildRequest("scopeType=folder&scopeId=folder_404"));
    const folderBody = await folderResponse.json();
    expect(folderResponse.status).toBe(404);
    expect(folderBody.error).toBe("Folder not found");

    const feedResponse = await GET(buildRequest("scopeType=feed&scopeId=feed_404"));
    const feedBody = await feedResponse.json();
    expect(feedResponse.status).toBe(404);
    expect(feedBody.error).toBe("Feed not found");
  });

  it("supports uncategorized scope requests", async () => {
    mocks.listArticlePageForUser.mockResolvedValue({
      status: "ok",
      items: [],
      nextCursor: null,
      hasMore: false,
      limit: 40,
      scope: { type: "uncategorized" },
    });

    const response = await GET(buildRequest("scopeType=uncategorized"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.scope).toEqual({ type: "uncategorized" });
  });

  it("supports saved scope requests", async () => {
    mocks.listArticlePageForUser.mockResolvedValue({
      status: "ok",
      items: [],
      nextCursor: null,
      hasMore: false,
      limit: 40,
      scope: { type: "saved" },
    });

    const response = await GET(buildRequest("scopeType=saved"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.scope).toEqual({ type: "saved" });
  });
});
