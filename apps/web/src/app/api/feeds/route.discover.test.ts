import type { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireAuth: vi.fn(),
  ensureUserRecord: vi.fn(),
  dbQueryFeedFolderMembershipsFindMany: vi.fn(),
  discoverFeedCandidates: vi.fn(),
  fetchFeedXml: vi.fn(),
  parseFeed: vi.fn(),
  parseFeedWithMetadata: vi.fn(),
  parseFeedXml: vi.fn(),
  normalizeFeedError: vi.fn(),
  createFeedWithInitialItems: vi.fn(),
  findExistingFeedForUserByUrl: vi.fn(),
  setFeedFoldersForUser: vi.fn(),
  markFeedItemReadForUser: vi.fn(),
  purgeOldFeedItemsForUser: vi.fn(),
  assertTrustedWriteOrigin: vi.fn(),
  applyRouteRateLimit: vi.fn(),
}));

vi.mock("@/lib/database", () => ({
  db: {
    query: {
      feedFolderMemberships: {
        findMany: mocks.dbQueryFeedFolderMembershipsFindMany,
      },
    },
  },
  and: vi.fn(),
  eq: vi.fn(),
  inArray: vi.fn(),
  feedFolderMemberships: {},
  folders: {},
  users: {},
}));

vi.mock("@/lib/auth", () => ({
  requireAuth: mocks.requireAuth,
  deleteAuthUser: vi.fn(),
}));

vi.mock("@/lib/app-user", () => ({
  ensureUserRecord: mocks.ensureUserRecord,
}));

vi.mock("@/lib/feed-discovery", () => ({
  discoverFeedCandidates: mocks.discoverFeedCandidates,
}));

vi.mock("@/lib/feed-parser", () => ({
  parseFeed: mocks.parseFeed,
  parseFeedWithMetadata: mocks.parseFeedWithMetadata,
  parseFeedXml: mocks.parseFeedXml,
}));

vi.mock("@/lib/feed-errors", () => ({
  normalizeFeedError: mocks.normalizeFeedError,
}));

vi.mock("@/lib/feed-fetcher", () => ({
  fetchFeedXml: mocks.fetchFeedXml,
}));

vi.mock("@/lib/feed-service", () => ({
  createFeedWithInitialItems: mocks.createFeedWithInitialItems,
  findExistingFeedForUserByUrl: mocks.findExistingFeedForUserByUrl,
  setFeedFoldersForUser: mocks.setFeedFoldersForUser,
  markFeedItemReadForUser: mocks.markFeedItemReadForUser,
}));

vi.mock("@/lib/retention", () => ({
  purgeOldFeedItemsForUser: mocks.purgeOldFeedItemsForUser,
}));

vi.mock("@/lib/csrf", () => ({
  assertTrustedWriteOrigin: mocks.assertTrustedWriteOrigin,
}));

vi.mock("@/lib/rate-limit", () => ({
  applyRouteRateLimit: mocks.applyRouteRateLimit,
}));

import { POST } from "@/app/api/feeds/route";

function createDiscoverRequest(url: string): NextRequest {
  return new Request("https://app.feedmyowl.test/api/feeds", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "feed.discover",
      url,
    }),
  }) as NextRequest;
}

describe("POST /api/feeds feed.discover", () => {
  beforeEach(() => {
    mocks.parseFeed.mockReset();
    mocks.parseFeedWithMetadata.mockReset();
    mocks.parseFeedXml.mockReset();
    mocks.normalizeFeedError.mockReset();
    mocks.discoverFeedCandidates.mockReset();
    mocks.findExistingFeedForUserByUrl.mockReset();
    mocks.fetchFeedXml.mockReset();

    mocks.requireAuth.mockResolvedValue({ clerkId: "clerk_123" });
    mocks.ensureUserRecord.mockResolvedValue({ id: "user_123", clerkId: "clerk_123" });
    mocks.dbQueryFeedFolderMembershipsFindMany.mockResolvedValue([]);
    mocks.findExistingFeedForUserByUrl.mockResolvedValue(null);
    mocks.discoverFeedCandidates.mockResolvedValue({
      candidates: [],
      methodHints: {},
    });
    mocks.assertTrustedWriteOrigin.mockReturnValue(null);
    mocks.applyRouteRateLimit.mockResolvedValue({ allowed: true });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("returns single when one addable candidate is found", async () => {
    mocks.parseFeed.mockResolvedValue({
      title: "Direct Feed",
      description: "Example",
      items: [],
    });

    const response = await POST(createDiscoverRequest("https://example.com/feed.xml"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.status).toBe("single");
    expect(body.normalizedInputUrl).toBe("https://example.com/feed.xml");
    expect(body.candidates).toEqual([
      {
        url: "https://example.com/feed.xml",
        title: "Direct Feed",
        method: "direct",
        duplicate: false,
        existingFeedId: null,
      },
    ]);
  });

  it("returns multiple when more than one addable candidate is found", async () => {
    mocks.parseFeed.mockRejectedValue(new Error("Input URL is not valid RSS/Atom"));
    mocks.normalizeFeedError.mockReturnValue({
      code: "invalid_xml",
      message: "Not a feed URL.",
    });
    mocks.discoverFeedCandidates.mockResolvedValue({
      candidates: ["https://example.com/feed.xml", "https://example.com/rss.xml"],
      methodHints: {
        "https://example.com/feed.xml": "html_alternate",
        "https://example.com/rss.xml": "heuristic_path",
      },
    });
    mocks.fetchFeedXml.mockImplementation(async (url: string) => ({
      status: "ok",
      text: "<rss><channel><title>Example</title></channel></rss>",
      etag: null,
      lastModified: null,
      finalUrl: url,
      statusCode: 200,
    }));
    mocks.parseFeedXml
      .mockResolvedValueOnce({
        title: "Main feed",
        description: "Main",
        items: [],
      })
      .mockResolvedValueOnce({
        title: "Blog feed",
        description: "Blog",
        items: [],
      });

    const response = await POST(createDiscoverRequest("https://example.com"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.status).toBe("multiple");
    expect(body.candidates).toEqual([
      {
        url: "https://example.com/feed.xml",
        title: "Main feed",
        method: "html_alternate",
        duplicate: false,
        existingFeedId: null,
      },
      {
        url: "https://example.com/rss.xml",
        title: "Blog feed",
        method: "heuristic_path",
        duplicate: false,
        existingFeedId: null,
      },
    ]);
  });

  it("returns duplicate when all valid candidates are already subscribed", async () => {
    mocks.parseFeed.mockResolvedValue({
      title: "Direct Feed",
      description: "Example",
      items: [],
    });
    mocks.findExistingFeedForUserByUrl.mockResolvedValue({
      id: "feed_123",
    });

    const response = await POST(createDiscoverRequest("https://example.com/feed.xml"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.status).toBe("duplicate");
    expect(body.candidates[0]).toMatchObject({
      url: "https://example.com/feed.xml",
      duplicate: true,
      existingFeedId: "feed_123",
      method: "direct",
    });
  });

  it("returns invalid_url for malformed input", async () => {
    const response = await POST(createDiscoverRequest("://broken"));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.code).toBe("invalid_url");
  });

  it("returns invalid_xml with the exact fallback message when no candidates are valid", async () => {
    mocks.parseFeed.mockRejectedValue(new Error("Input URL is not valid RSS/Atom"));
    mocks.normalizeFeedError.mockReturnValue({
      code: "invalid_xml",
      message: "Not a feed URL.",
    });
    mocks.discoverFeedCandidates.mockResolvedValue({
      candidates: ["https://example.com/feed.xml", "https://example.com/rss.xml"],
      methodHints: {
        "https://example.com/feed.xml": "html_alternate",
        "https://example.com/rss.xml": "heuristic_path",
      },
    });
    mocks.fetchFeedXml.mockResolvedValue({
      status: "ok",
      text: "<html><body>not a feed</body></html>",
      etag: null,
      lastModified: null,
      finalUrl: "https://example.com/feed.xml",
      statusCode: 200,
    });
    mocks.parseFeedXml.mockRejectedValue(new Error("Invalid feed XML"));

    const response = await POST(createDiscoverRequest("https://example.com"));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.code).toBe("invalid_xml");
    expect(body.error).toBe(
      "Error: We couldn't find any feed at this URL. Contact site owner and ask for the feed link."
    );
  });

  it("returns 429 when route-level rate limit is exceeded", async () => {
    mocks.applyRouteRateLimit.mockResolvedValue({
      allowed: false,
      response: Response.json(
        {
          error: "Rate limit exceeded. Please wait before trying again.",
          code: "rate_limited",
        },
        {
          status: 429,
          headers: {
            "Retry-After": "2",
          },
        }
      ),
    });

    const response = await POST(createDiscoverRequest("https://example.com/feed.xml"));
    const body = await response.json();

    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBe("2");
    expect(body.code).toBe("rate_limited");
  });
});
