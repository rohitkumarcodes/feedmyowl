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
  setFeedFoldersForUser: vi.fn(),
  markFeedItemReadForUser: vi.fn(),
  deleteUncategorizedFeedsForUser: vi.fn(),
  purgeOldFeedItemsForUser: vi.fn(),
  assertTrustedWriteOrigin: vi.fn(),
  applyRouteRateLimit: vi.fn(),
}));

vi.mock("@/lib/server/database", () => ({
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

vi.mock("@/lib/server/auth", () => ({
  requireAuth: mocks.requireAuth,
  deleteAuthUser: vi.fn(),
  isAuthRequiredError: vi.fn(() => false),
}));

vi.mock("@/lib/server/app-user", () => ({
  ensureUserRecord: mocks.ensureUserRecord,
}));

vi.mock("@/lib/server/feed-discovery", () => ({
  discoverFeedCandidates: mocks.discoverFeedCandidates,
}));

vi.mock("@/lib/server/feed-parser", () => ({
  parseFeed: mocks.parseFeed,
  parseFeedWithMetadata: mocks.parseFeedWithMetadata,
  parseFeedXml: mocks.parseFeedXml,
}));

vi.mock("@/lib/shared/feed-errors", () => ({
  normalizeFeedError: mocks.normalizeFeedError,
}));

vi.mock("@/lib/server/feed-fetcher", () => ({
  fetchFeedXml: mocks.fetchFeedXml,
}));

vi.mock("@/lib/server/feed-service", () => ({
  createFeedWithInitialItems: mocks.createFeedWithInitialItems,
  findExistingFeedForUserByUrl: mocks.findExistingFeedForUserByUrl,
  setFeedFoldersForUser: mocks.setFeedFoldersForUser,
  markFeedItemReadForUser: mocks.markFeedItemReadForUser,
  deleteUncategorizedFeedsForUser: mocks.deleteUncategorizedFeedsForUser,
}));

vi.mock("@/lib/server/retention", () => ({
  purgeOldFeedItemsForUser: mocks.purgeOldFeedItemsForUser,
}));

vi.mock("@/lib/server/csrf", () => ({
  assertTrustedWriteOrigin: mocks.assertTrustedWriteOrigin,
}));

vi.mock("@/lib/server/rate-limit", () => ({
  applyRouteRateLimit: mocks.applyRouteRateLimit,
}));

import { POST } from "@/app/api/feeds/route";

function createFeedCreateRequest(url: string, folderIds: string[] = []): NextRequest {
  return new Request("https://app.feedmyowl.test/api/feeds", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "feed.create",
      url,
      folderIds,
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
    mocks.setFeedFoldersForUser.mockResolvedValue({
      status: "ok",
      folderIds: [],
    });

    mocks.parseFeed.mockRejectedValue(new Error("Input URL is not valid RSS/Atom"));
    mocks.parseFeedWithMetadata.mockRejectedValue(
      new Error("Input URL is not valid RSS/Atom"),
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
      },
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
      },
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
      "Error: We couldn't find any feed at this URL. Contact site owner and ask for the feed link.",
    );
    expect(mocks.createFeedWithInitialItems).not.toHaveBeenCalled();
    expect(mocks.fetchFeedXml).toHaveBeenCalledTimes(2);
  });

  it("merges selected folders when a direct duplicate feed already exists", async () => {
    mocks.dbQueryFoldersFindMany.mockResolvedValue([{ id: "folder_news" }]);
    mocks.dbQueryFeedFolderMembershipsFindMany.mockResolvedValue([
      { folderId: "folder_existing" },
    ]);
    mocks.findExistingFeedForUserByUrl.mockResolvedValue({
      id: "feed_123",
      userId: "user_123",
      url: "https://example.com/feed.xml",
    });
    mocks.setFeedFoldersForUser.mockResolvedValue({
      status: "ok",
      folderIds: ["folder_existing", "folder_news"],
    });

    const response = await POST(
      createFeedCreateRequest("https://example.com/feed.xml", ["folder_news"]),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.duplicate).toBe(true);
    expect(body.mergedFolderCount).toBe(1);
    expect(body.message).toBe("This feed is already in your library. Added to 1 folder.");
    expect(body.feed.folderIds).toEqual(["folder_existing", "folder_news"]);
    expect(mocks.setFeedFoldersForUser).toHaveBeenCalledWith("user_123", "feed_123", [
      "folder_existing",
      "folder_news",
    ]);
    expect(mocks.createFeedWithInitialItems).not.toHaveBeenCalled();
  });

  it("keeps duplicate folder assignments unchanged when no new folder is selected", async () => {
    mocks.dbQueryFoldersFindMany.mockResolvedValue([{ id: "folder_existing" }]);
    mocks.dbQueryFeedFolderMembershipsFindMany.mockResolvedValue([
      { folderId: "folder_existing" },
    ]);
    mocks.findExistingFeedForUserByUrl.mockResolvedValue({
      id: "feed_123",
      userId: "user_123",
      url: "https://example.com/feed.xml",
    });

    const response = await POST(
      createFeedCreateRequest("https://example.com/feed.xml", ["folder_existing"]),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.duplicate).toBe(true);
    expect(body.mergedFolderCount).toBe(0);
    expect(body.message).toBe("This feed is already in your library.");
    expect(body.feed.folderIds).toEqual(["folder_existing"]);
    expect(mocks.setFeedFoldersForUser).not.toHaveBeenCalled();
  });

  it("merges selected folders when discovery fallback hits an existing candidate feed", async () => {
    const discoveredCandidate = "https://example.com/feed.xml";

    mocks.dbQueryFoldersFindMany.mockResolvedValue([{ id: "folder_news" }]);
    mocks.dbQueryFeedFolderMembershipsFindMany.mockResolvedValue([]);
    mocks.parseFeedWithMetadata.mockRejectedValue(
      new Error("Input URL is not valid RSS/Atom"),
    );
    mocks.normalizeFeedError.mockReturnValue({
      code: "invalid_xml",
      message: "Not a feed URL.",
    });
    mocks.discoverFeedCandidates.mockResolvedValue({
      candidates: [discoveredCandidate],
      methodHints: {
        [discoveredCandidate]: "html_alternate",
      },
    });
    mocks.findExistingFeedForUserByUrl.mockResolvedValueOnce(null).mockResolvedValueOnce({
      id: "feed_789",
      userId: "user_123",
      url: discoveredCandidate,
    });
    mocks.setFeedFoldersForUser.mockResolvedValue({
      status: "ok",
      folderIds: ["folder_news"],
    });

    const response = await POST(
      createFeedCreateRequest("https://example.com", ["folder_news"]),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.duplicate).toBe(true);
    expect(body.mergedFolderCount).toBe(1);
    expect(body.feed.folderIds).toEqual(["folder_news"]);
    expect(mocks.setFeedFoldersForUser).toHaveBeenCalledWith("user_123", "feed_789", [
      "folder_news",
    ]);
  });

  it("requires an explicit action", async () => {
    const response = await POST(
      new Request("https://app.feedmyowl.test/api/feeds", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: "https://example.com/feed.xml",
        }),
      }) as NextRequest,
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe("Action is required");
  });
});
