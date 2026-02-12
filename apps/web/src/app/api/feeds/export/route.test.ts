import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireAuth: vi.fn(),
  ensureUserRecord: vi.fn(),
  dbQueryUsersFindFirst: vi.fn(),
  applyRouteRateLimit: vi.fn(),
  captureMessage: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  requireAuth: mocks.requireAuth,
  isAuthRequiredError: vi.fn(() => false),
}));

vi.mock("@/lib/app-user", () => ({
  ensureUserRecord: mocks.ensureUserRecord,
}));

vi.mock("@/lib/database", () => ({
  db: {
    query: {
      users: {
        findFirst: mocks.dbQueryUsersFindFirst,
      },
    },
  },
  eq: vi.fn(() => ({})),
  users: {},
}));

vi.mock("@/lib/rate-limit", () => ({
  applyRouteRateLimit: mocks.applyRouteRateLimit,
}));

vi.mock("@/lib/error-tracking", () => ({
  captureMessage: mocks.captureMessage,
}));

import { GET } from "@/app/api/feeds/export/route";

function createRequest(url: string): NextRequest {
  return new NextRequest(url, { method: "GET" });
}

function createMockUserRecord() {
  const now = new Date("2026-02-11T00:00:00.000Z");

  return {
    id: "user_123",
    clerkId: "clerk_123",
    email: "user@example.com",
    createdAt: now,
    folders: [
      {
        id: "folder_1",
        name: "Tech",
        createdAt: now,
        updatedAt: now,
      },
      {
        id: "folder_2",
        name: "News",
        createdAt: now,
        updatedAt: now,
      },
    ],
    feeds: [
      {
        id: "feed_1",
        url: "https://example.com/feed.xml",
        title: "Example Feed",
        customTitle: "Custom Feed",
        description: "Example description",
        folderId: "folder_1",
        lastFetchedAt: now,
        createdAt: now,
        updatedAt: now,
        folderMemberships: [{ folderId: "folder_1" }, { folderId: "folder_2" }],
        items: [
          {
            id: "item_1",
            guid: "guid_1",
            title: "Item one",
            link: "https://example.com/item-1",
            author: "Example Author",
            publishedAt: now,
            readAt: null,
            createdAt: now,
            updatedAt: now,
          },
        ],
      },
    ],
  };
}

describe("GET /api/feeds/export", () => {
  beforeEach(() => {
    mocks.requireAuth.mockResolvedValue({ clerkId: "clerk_123" });
    mocks.ensureUserRecord.mockResolvedValue({ id: "user_123", clerkId: "clerk_123" });
    mocks.dbQueryUsersFindFirst.mockResolvedValue(createMockUserRecord());
    mocks.applyRouteRateLimit.mockResolvedValue({ allowed: true });
  });

  it("returns OPML export grouped by folders", async () => {
    const response = await GET(
      createRequest("https://app.feedmyowl.test/api/feeds/export?format=opml")
    );
    const body = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/x-opml");
    expect(body).toContain("<opml version=\"2.0\">");
    expect(body).toContain("xmlUrl=\"https://example.com/feed.xml\"");
    expect(body).toContain("outline text=\"Tech\"");
    // htmlUrl should not be present (we don't store site URLs).
    expect(body).not.toContain("htmlUrl=");
    // ownerEmail from the user record should be in the head.
    expect(body).toContain("<ownerEmail>user@example.com</ownerEmail>");
  });

  it("returns portable JSON v2 with all folder names", async () => {
    const response = await GET(
      createRequest("https://app.feedmyowl.test/api/feeds/export?format=json")
    );
    const body = (await response.json()) as {
      version: number;
      sourceApp: string;
      folders: string[];
      feeds: Array<{
        url: string;
        customTitle: string | null;
        folders: string[];
      }>;
    };

    expect(response.status).toBe(200);
    expect(body.version).toBe(2);
    expect(body.sourceApp).toBe("FeedMyOwl");
    // All folder names are listed (including empty ones).
    expect(body.folders).toEqual(["News", "Tech"]);
    expect(body.feeds).toEqual([
      {
        url: "https://example.com/feed.xml",
        customTitle: "Custom Feed",
        folders: ["News", "Tech"],
      },
    ]);
  });

  it("exports nested folder hierarchy in OPML from flattened folder names", async () => {
    const now = new Date("2026-02-11T00:00:00.000Z");
    mocks.dbQueryUsersFindFirst.mockResolvedValue({
      id: "user_123",
      clerkId: "clerk_123",
      email: "user@example.com",
      createdAt: now,
      folders: [
        { id: "folder_nested", name: "Tech / Web", createdAt: now, updatedAt: now },
      ],
      feeds: [
        {
          id: "feed_nested",
          url: "https://example.com/nested.xml",
          title: "Nested Feed",
          customTitle: null,
          description: null,
          lastFetchedAt: now,
          createdAt: now,
          updatedAt: now,
          folderMemberships: [{ folderId: "folder_nested" }],
        },
      ],
    });

    const response = await GET(
      createRequest("https://app.feedmyowl.test/api/feeds/export?format=opml")
    );
    const body = await response.text();

    expect(response.status).toBe(200);
    // Should produce nested <outline> elements, not a flat "Tech / Web" folder.
    expect(body).toContain('outline text="Tech"');
    expect(body).toContain('outline text="Web"');
    expect(body).not.toContain('outline text="Tech / Web"');
  });

  it("returns 400 for unsupported JSON export version", async () => {
    const response = await GET(
      createRequest("https://app.feedmyowl.test/api/feeds/export?format=json&version=1")
    );
    const body = (await response.json()) as { error?: string };

    expect(response.status).toBe(400);
    expect(body.error).toBe("Unsupported JSON export version");
  });

  it("returns 400 for unsupported export format", async () => {
    const response = await GET(
      createRequest("https://app.feedmyowl.test/api/feeds/export?format=csv")
    );
    const body = (await response.json()) as { error?: string };

    expect(response.status).toBe(400);
    expect(body.error).toBe("Unsupported export format");
  });

  it("returns 429 when export rate limit is exceeded", async () => {
    mocks.applyRouteRateLimit.mockResolvedValue({
      allowed: false,
      response: Response.json(
        { error: "Rate limit exceeded. Please wait before trying again.", code: "rate_limited" },
        {
          status: 429,
          headers: {
            "Retry-After": "12",
          },
        }
      ),
    });

    const response = await GET(
      createRequest("https://app.feedmyowl.test/api/feeds/export?format=opml")
    );
    const body = (await response.json()) as { code?: string };

    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBe("12");
    expect(body.code).toBe("rate_limited");
  });
});
