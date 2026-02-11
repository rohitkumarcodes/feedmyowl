import type { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireAuth: vi.fn(),
  ensureUserRecord: vi.fn(),
  dbQueryFoldersFindMany: vi.fn(),
  dbQueryFeedFolderMembershipsFindMany: vi.fn(),
  discoverFeedCandidates: vi.fn(),
  fetchFeedXml: vi.fn(),
  parseFeed: vi.fn(),
  parseFeedWithMetadata: vi.fn(),
  parseFeedXml: vi.fn(),
  normalizeFeedError: vi.fn(),
  createFeedWithInitialItems: vi.fn(),
  findExistingFeedForUserByUrl: vi.fn(),
  markFeedItemReadForUser: vi.fn(),
  purgeOldFeedItemsForUser: vi.fn(),
  assertTrustedWriteOrigin: vi.fn(),
  applyRouteRateLimit: vi.fn(),
}));

vi.mock("@/lib/database", () => ({
  db: {
    query: {
      folders: {
        findMany: mocks.dbQueryFoldersFindMany,
      },
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

function createFeedCreateRequest(url: string): NextRequest {
  return new Request("https://app.feedmyowl.test/api/feeds", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "feed.create",
      url,
    }),
  }) as NextRequest;
}

describe("POST /api/feeds discovery fallback", () => {
  beforeEach(() => {
    mocks.requireAuth.mockResolvedValue({ clerkId: "clerk_123" });
    mocks.ensureUserRecord.mockResolvedValue({ id: "user_123", clerkId: "clerk_123" });
    mocks.dbQueryFoldersFindMany.mockResolvedValue([]);
    mocks.dbQueryFeedFolderMembershipsFindMany.mockResolvedValue([]);
    mocks.findExistingFeedForUserByUrl.mockResolvedValue(null);

    mocks.parseFeed.mockRejectedValue(new Error("Input URL is not valid RSS/Atom"));
    mocks.parseFeedWithMetadata.mockRejectedValue(
      new Error("Input URL is not valid RSS/Atom")
    );
    mocks.normalizeFeedError.mockReturnValue({
      code: "invalid_xml",
      message: "This URL does not appear to be a valid RSS or Atom feed.",
    });
    mocks.assertTrustedWriteOrigin.mockReturnValue(null);
    mocks.applyRouteRateLimit.mockResolvedValue({ allowed: true });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("adds a feed when alternate-link discovery finds a valid candidate", async () => {
    const discoveredCandidate = "https://example.com/feed.xml";

    mocks.discoverFeedCandidates.mockResolvedValue({
      candidates: [discoveredCandidate],
      methodHints: {
        [discoveredCandidate]: "html_alternate",
      },
    });

    mocks.fetchFeedXml.mockResolvedValue({
      status: "ok",
      text: "<rss><channel><title>Example</title></channel></rss>",
      etag: null,
      lastModified: null,
      finalUrl: discoveredCandidate,
      statusCode: 200,
    });

    mocks.parseFeedXml.mockResolvedValue({
      title: "Example Feed",
      description: "Example description",
      items: [],
    });

    mocks.createFeedWithInitialItems.mockResolvedValue({
      feed: {
        id: "feed_123",
        userId: "user_123",
        url: discoveredCandidate,
      },
      insertedItems: 0,
    });

    const response = await POST(createFeedCreateRequest("https://example.com"));
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.message).toBe("Feed found automatically and added.");
    expect(mocks.createFeedWithInitialItems).toHaveBeenCalledWith(
      "user_123",
      discoveredCandidate,
      expect.any(Object),
      [],
      {
        etag: null,
        lastModified: null,
      }
    );
  });

  it("adds a feed when heuristic discovery finds a valid candidate", async () => {
    const discoveredCandidate = "https://example.com/rss.xml";

    mocks.discoverFeedCandidates.mockResolvedValue({
      candidates: [discoveredCandidate],
      methodHints: {
        [discoveredCandidate]: "heuristic_path",
      },
    });

    mocks.fetchFeedXml.mockResolvedValue({
      status: "ok",
      text: "<rss><channel><title>Example</title></channel></rss>",
      etag: null,
      lastModified: null,
      finalUrl: discoveredCandidate,
      statusCode: 200,
    });

    mocks.parseFeedXml.mockResolvedValue({
      title: "Example Feed",
      description: "Example description",
      items: [],
    });

    mocks.createFeedWithInitialItems.mockResolvedValue({
      feed: {
        id: "feed_456",
        userId: "user_123",
        url: discoveredCandidate,
      },
      insertedItems: 0,
    });

    const response = await POST(createFeedCreateRequest("https://example.com/blog"));
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.message).toBe("Feed found automatically and added.");
    expect(mocks.createFeedWithInitialItems).toHaveBeenCalledWith(
      "user_123",
      discoveredCandidate,
      expect.any(Object),
      [],
      {
        etag: null,
        lastModified: null,
      }
    );
  });

  it("returns invalid_xml when all discovery candidates fail to parse", async () => {
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

    const response = await POST(createFeedCreateRequest("https://example.com"));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.code).toBe("invalid_xml");
    expect(body.error).toBe(
      "Error: We couldn't find any feed at this URL. Contact site owner and ask for the feed link."
    );
    expect(mocks.createFeedWithInitialItems).not.toHaveBeenCalled();
    expect(mocks.fetchFeedXml).toHaveBeenCalledTimes(2);
  });

  it("requires an explicit action", async () => {
    const response = await POST(
      new Request("https://app.feedmyowl.test/api/feeds", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: "https://example.com/feed.xml",
        }),
      }) as NextRequest
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe("Action is required");
  });
});
