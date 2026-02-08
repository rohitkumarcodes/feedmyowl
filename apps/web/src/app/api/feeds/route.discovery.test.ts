import type { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireAuth: vi.fn(),
  ensureUserRecord: vi.fn(),
  dbQueryFoldersFindMany: vi.fn(),
  dbQueryFeedFolderMembershipsFindMany: vi.fn(),
  discoverFeedCandidates: vi.fn(),
  parseFeed: vi.fn(),
  parseFeedXml: vi.fn(),
  normalizeFeedError: vi.fn(),
  createFeedWithInitialItems: vi.fn(),
  findExistingFeedForUserByUrl: vi.fn(),
  markFeedItemReadForUser: vi.fn(),
  purgeOldFeedItemsForUser: vi.fn(),
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
  parseFeedXml: mocks.parseFeedXml,
}));

vi.mock("@/lib/feed-errors", () => ({
  normalizeFeedError: mocks.normalizeFeedError,
}));

vi.mock("@/lib/feed-service", () => ({
  createFeedWithInitialItems: mocks.createFeedWithInitialItems,
  findExistingFeedForUserByUrl: mocks.findExistingFeedForUserByUrl,
  markFeedItemReadForUser: mocks.markFeedItemReadForUser,
}));

vi.mock("@/lib/retention", () => ({
  purgeOldFeedItemsForUser: mocks.purgeOldFeedItemsForUser,
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
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);

    mocks.requireAuth.mockResolvedValue({ clerkId: "clerk_123" });
    mocks.ensureUserRecord.mockResolvedValue({ id: "user_123", clerkId: "clerk_123" });
    mocks.dbQueryFoldersFindMany.mockResolvedValue([]);
    mocks.dbQueryFeedFolderMembershipsFindMany.mockResolvedValue([]);
    mocks.findExistingFeedForUserByUrl.mockResolvedValue(null);

    mocks.parseFeed.mockRejectedValue(new Error("Input URL is not valid RSS/Atom"));
    mocks.normalizeFeedError.mockReturnValue({
      code: "invalid_xml",
      message: "This URL does not appear to be a valid RSS or Atom feed.",
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("adds a feed when alternate-link discovery finds a valid candidate", async () => {
    const discoveredCandidate = "https://example.com/feed.xml";

    mocks.discoverFeedCandidates.mockResolvedValue({
      candidates: [discoveredCandidate],
      methodHints: {
        [discoveredCandidate]: "html_alternate",
      },
    });

    fetchMock.mockResolvedValue(
      new Response("<rss><channel><title>Example</title></channel></rss>", {
        status: 200,
        headers: { "content-type": "application/rss+xml" },
      })
    );

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
      []
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

    fetchMock.mockResolvedValue(
      new Response("<rss><channel><title>Example</title></channel></rss>", {
        status: 200,
        headers: { "content-type": "application/rss+xml" },
      })
    );

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
      []
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

    fetchMock.mockImplementation(async () => {
      return new Response("<html><body>not a feed</body></html>", {
        status: 200,
        headers: { "content-type": "text/html" },
      });
    });

    mocks.parseFeedXml.mockRejectedValue(new Error("Invalid feed XML"));

    const response = await POST(createFeedCreateRequest("https://example.com"));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.code).toBe("invalid_xml");
    expect(body.error).toBe(
      "Could not find a valid RSS/Atom feed at this address. Try pasting the feed URL directly."
    );
    expect(mocks.createFeedWithInitialItems).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
