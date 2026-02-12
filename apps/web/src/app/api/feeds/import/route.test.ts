import type { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireAuth: vi.fn(),
  ensureUserRecord: vi.fn(),
  dbQueryFoldersFindMany: vi.fn(),
  dbQueryFeedFolderMembershipsFindMany: vi.fn(),
  discoverFeedCandidates: vi.fn(),
  parseFeedWithMetadata: vi.fn(),
  normalizeFeedError: vi.fn(),
  createFeedWithInitialItems: vi.fn(),
  findExistingFeedForUserByUrl: vi.fn(),
  renameFeedForUser: vi.fn(),
  addFeedFoldersForUser: vi.fn(),
  createFolderForUser: vi.fn(),
  captureMessage: vi.fn(),
  assertTrustedWriteOrigin: vi.fn(),
  applyRouteRateLimit: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  requireAuth: mocks.requireAuth,
}));

vi.mock("@/lib/app-user", () => ({
  ensureUserRecord: mocks.ensureUserRecord,
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
  and: vi.fn(() => ({})),
  eq: vi.fn(() => ({})),
  feedFolderMemberships: {},
  folders: {},
  users: {},
}));

vi.mock("@/lib/feed-discovery", () => ({
  discoverFeedCandidates: mocks.discoverFeedCandidates,
}));

vi.mock("@/lib/feed-parser", () => ({
  parseFeedWithMetadata: mocks.parseFeedWithMetadata,
}));

vi.mock("@/lib/feed-errors", () => ({
  normalizeFeedError: mocks.normalizeFeedError,
}));

vi.mock("@/lib/feed-service", () => ({
  createFeedWithInitialItems: mocks.createFeedWithInitialItems,
  findExistingFeedForUserByUrl: mocks.findExistingFeedForUserByUrl,
  renameFeedForUser: mocks.renameFeedForUser,
  addFeedFoldersForUser: mocks.addFeedFoldersForUser,
}));

vi.mock("@/lib/folder-service", () => ({
  FOLDER_NAME_MAX_LENGTH: 255,
  createFolderForUser: mocks.createFolderForUser,
}));

vi.mock("@/lib/error-tracking", () => ({
  captureMessage: mocks.captureMessage,
}));

vi.mock("@/lib/csrf", () => ({
  assertTrustedWriteOrigin: mocks.assertTrustedWriteOrigin,
}));

vi.mock("@/lib/rate-limit", () => ({
  applyRouteRateLimit: mocks.applyRouteRateLimit,
}));

import { POST } from "@/app/api/feeds/import/route";

function createImportRequest(
  body: Record<string, unknown> | string,
  options?: { headers?: Record<string, string> }
): NextRequest {
  const payload = typeof body === "string" ? body : JSON.stringify(body);

  return new Request("https://app.feedmyowl.test/api/feeds/import", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(options?.headers ?? {}),
    },
    body: payload,
  }) as NextRequest;
}

describe("POST /api/feeds/import", () => {
  beforeEach(() => {
    mocks.requireAuth.mockResolvedValue({ clerkId: "clerk_123" });
    mocks.ensureUserRecord.mockResolvedValue({ id: "user_123", clerkId: "clerk_123" });
    mocks.dbQueryFoldersFindMany.mockResolvedValue([]);
    mocks.dbQueryFeedFolderMembershipsFindMany.mockResolvedValue([]);
    mocks.discoverFeedCandidates.mockResolvedValue({ candidates: [], methodHints: {} });
    mocks.normalizeFeedError.mockReturnValue({
      code: "invalid_xml",
      message: "This URL does not appear to be a valid RSS or Atom feed.",
    });
    mocks.parseFeedWithMetadata.mockResolvedValue({
      parsedFeed: {
        title: "Parsed Feed",
        description: "Parsed",
        items: [],
      },
      etag: null,
      lastModified: null,
      resolvedUrl: "https://new.example.com/feed.xml",
    });
    mocks.findExistingFeedForUserByUrl.mockResolvedValue(null);
    mocks.createFeedWithInitialItems.mockResolvedValue({
      feed: { id: "feed_123", folderId: null },
      insertedItems: 0,
    });
    mocks.renameFeedForUser.mockResolvedValue({ id: "feed_123" });
    mocks.addFeedFoldersForUser.mockResolvedValue({
      status: "ok",
      addedFolderIds: [],
      folderIds: [],
    });
    mocks.createFolderForUser.mockResolvedValue({
      status: "ok",
      folder: {
        id: "folder_123",
        name: "Tech",
        createdAt: new Date("2026-02-11T00:00:00.000Z"),
        updatedAt: new Date("2026-02-11T00:00:00.000Z"),
      },
    });
    mocks.assertTrustedWriteOrigin.mockReturnValue(null);
    mocks.applyRouteRateLimit.mockResolvedValue({ allowed: true });
  });

  it("imports valid feed entries and applies custom title only to newly created feeds", async () => {
    mocks.findExistingFeedForUserByUrl.mockImplementation(async (_userId: string, url: string) =>
      url === "https://existing.example.com/feed.xml"
        ? ({
            id: "feed_existing",
            folderId: null,
          } as never)
        : null
    );
    mocks.parseFeedWithMetadata.mockResolvedValue({
      parsedFeed: {
        title: "Parsed Feed",
        description: "Parsed",
        items: [],
      },
      etag: null,
      lastModified: null,
      resolvedUrl: "https://new.example.com/feed.xml",
    });
    mocks.createFeedWithInitialItems.mockResolvedValue({
      feed: { id: "feed_new", folderId: null },
      insertedItems: 0,
    });

    const response = await POST(
      createImportRequest({
        sourceType: "JSON",
        entries: [
          {
            url: "https://existing.example.com/feed.xml",
            folderNames: [],
            customTitle: "Do not apply",
          },
          {
            url: "https://new.example.com/feed.xml",
            folderNames: [],
            customTitle: "Apply this title",
          },
        ],
      })
    );
    const body = (await response.json()) as {
      rows: Array<{ status: string }>;
      importedCount: number;
      duplicateCount: number;
    };

    expect(response.status).toBe(200);
    expect(body.importedCount).toBe(1);
    expect(body.duplicateCount).toBe(1);
    expect(body.rows.map((row) => row.status)).toEqual([
      "duplicate_unchanged",
      "imported",
    ]);
    expect(mocks.applyRouteRateLimit).toHaveBeenCalledWith(
      expect.objectContaining({
        routeKey: "api_feeds_import_post",
        userId: "user_123",
        userLimitPerMinute: 25,
        ipLimitPerMinute: 100,
      })
    );
    expect(mocks.renameFeedForUser).toHaveBeenCalledTimes(1);
    expect(mocks.renameFeedForUser).toHaveBeenCalledWith(
      "user_123",
      "feed_new",
      "Apply this title"
    );
  });

  it("returns failed invalid_url for malformed entry URLs", async () => {
    const response = await POST(
      createImportRequest({
        sourceType: "JSON",
        entries: [{ url: "://broken", folderNames: [], customTitle: null }],
      })
    );
    const body = (await response.json()) as {
      rows: Array<{ status: string; code?: string }>;
      failedCount: number;
    };

    expect(response.status).toBe(200);
    expect(body.failedCount).toBe(1);
    expect(body.rows[0]).toMatchObject({
      status: "failed",
      code: "invalid_url",
    });
  });

  it("imports a discovered candidate when direct parsing fails with a non-invalid_xml error", async () => {
    mocks.parseFeedWithMetadata.mockImplementation(async (url: string) => {
      if (url === "https://example.com/") {
        throw new Error("Network request failed");
      }

      return {
        parsedFeed: {
          title: "Discovered Feed",
          description: "Discovered",
          items: [],
        },
        etag: null,
        lastModified: null,
        resolvedUrl: url,
      };
    });
    mocks.normalizeFeedError.mockReturnValue({
      code: "network",
      message: "Could not reach this URL. Check the address and try again.",
    });
    mocks.discoverFeedCandidates.mockResolvedValue({
      candidates: ["https://example.com/feed.xml"],
      methodHints: {
        "https://example.com/feed.xml": "html_alternate",
      },
    });
    mocks.createFeedWithInitialItems.mockResolvedValue({
      feed: { id: "feed_discovered", folderId: null },
      insertedItems: 0,
    });

    const response = await POST(
      createImportRequest({
        sourceType: "JSON",
        entries: [{ url: "https://example.com", folderNames: [], customTitle: null }],
      })
    );
    const body = (await response.json()) as {
      rows: Array<{ status: string; message?: string }>;
      importedCount: number;
      failedCount: number;
    };

    expect(response.status).toBe(200);
    expect(body.importedCount).toBe(1);
    expect(body.failedCount).toBe(0);
    expect(body.rows[0]).toMatchObject({
      status: "imported",
      message: "Feed found automatically and added.",
    });
    expect(mocks.createFeedWithInitialItems).toHaveBeenCalledWith(
      "user_123",
      "https://example.com/feed.xml",
      expect.any(Object),
      [],
      {
        etag: null,
        lastModified: null,
      }
    );
  });

  it("returns mapped direct failure when direct parsing fails with non-invalid_xml and discovery has no valid candidates", async () => {
    mocks.parseFeedWithMetadata.mockImplementation(async (url: string) => {
      if (url === "https://example.com/" || url === "https://example.com/feed.xml") {
        throw new Error("Timed out");
      }

      return {
        parsedFeed: {
          title: "Unexpected",
          description: "Unexpected",
          items: [],
        },
        etag: null,
        lastModified: null,
        resolvedUrl: url,
      };
    });
    mocks.normalizeFeedError.mockReturnValue({
      code: "timeout",
      message: "This feed could not be updated. The server did not respond in time. This is often temporary.",
    });
    mocks.discoverFeedCandidates.mockResolvedValue({
      candidates: ["https://example.com/feed.xml"],
      methodHints: {
        "https://example.com/feed.xml": "heuristic_path",
      },
    });

    const response = await POST(
      createImportRequest({
        sourceType: "JSON",
        entries: [{ url: "https://example.com", folderNames: [], customTitle: null }],
      })
    );
    const body = (await response.json()) as {
      rows: Array<{ status: string; code?: string; message?: string }>;
      failedCount: number;
    };

    expect(response.status).toBe(200);
    expect(body.failedCount).toBe(1);
    expect(body.rows[0]).toMatchObject({
      status: "failed",
      code: "network_timeout",
      message:
        "This feed could not be updated. The server did not respond in time. This is often temporary.",
    });
  });

  it("merges folders for duplicates and reuses existing/new folder IDs", async () => {
    mocks.findExistingFeedForUserByUrl.mockResolvedValue({
      id: "feed_existing",
      folderId: null,
    });
    mocks.createFolderForUser.mockResolvedValue({
      status: "ok",
      folder: {
        id: "folder_merged",
        name: "Merged Folder",
        createdAt: new Date("2026-02-11T00:00:00.000Z"),
        updatedAt: new Date("2026-02-11T00:00:00.000Z"),
      },
    });
    mocks.dbQueryFeedFolderMembershipsFindMany.mockResolvedValue([]);
    mocks.addFeedFoldersForUser.mockResolvedValue({
      status: "ok",
      addedFolderIds: ["folder_merged"],
      folderIds: ["folder_merged"],
    });

    const response = await POST(
      createImportRequest({
        sourceType: "OPML",
        entries: [
          {
            url: "https://existing.example.com/feed.xml",
            folderNames: ["Merged Folder"],
            customTitle: null,
          },
        ],
      })
    );
    const body = (await response.json()) as {
      rows: Array<{ status: string; code?: string }>;
      mergedCount: number;
    };

    expect(response.status).toBe(200);
    expect(body.mergedCount).toBe(1);
    expect(body.rows[0]).toMatchObject({
      status: "duplicate_merged",
      code: "duplicate",
    });
    expect(mocks.addFeedFoldersForUser).toHaveBeenCalledWith(
      "user_123",
      "feed_existing",
      ["folder_merged"]
    );
  });

  it("keeps duplicate unchanged when no new folders are provided", async () => {
    mocks.findExistingFeedForUserByUrl.mockResolvedValue({
      id: "feed_existing",
      folderId: null,
    });

    const response = await POST(
      createImportRequest({
        sourceType: "JSON",
        entries: [
          {
            url: "https://existing.example.com/feed.xml",
            folderNames: [],
            customTitle: null,
          },
        ],
      })
    );
    const body = (await response.json()) as { rows: Array<{ status: string }> };

    expect(response.status).toBe(200);
    expect(body.rows[0].status).toBe("duplicate_unchanged");
    expect(mocks.addFeedFoldersForUser).not.toHaveBeenCalled();
  });

  it("skips entries with multiple addable discovery candidates", async () => {
    mocks.parseFeedWithMetadata.mockImplementation(async (url: string) => {
      if (url === "https://example.com/") {
        throw new Error("Input URL is not valid RSS/Atom");
      }
      return {
        parsedFeed: {
          title: "Candidate",
          description: "Candidate",
          items: [],
        },
        etag: null,
        lastModified: null,
        resolvedUrl: url,
      };
    });
    mocks.normalizeFeedError.mockReturnValue({
      code: "invalid_xml",
      message: "Not a direct feed.",
    });
    mocks.discoverFeedCandidates.mockResolvedValue({
      candidates: ["https://example.com/feed.xml", "https://example.com/rss.xml"],
      methodHints: {
        "https://example.com/feed.xml": "heuristic_path",
        "https://example.com/rss.xml": "heuristic_path",
      },
    });

    const response = await POST(
      createImportRequest({
        sourceType: "JSON",
        entries: [{ url: "https://example.com", folderNames: [], customTitle: null }],
      })
    );
    const body = (await response.json()) as {
      rows: Array<{ status: string; code?: string }>;
      failedCount: number;
    };

    expect(response.status).toBe(200);
    expect(body.failedCount).toBe(1);
    expect(body.rows[0]).toMatchObject({
      status: "skipped_multiple_candidates",
      code: "multiple_candidates",
    });
  });

  it("creates one folder and reuses it across multiple entries in one request", async () => {
    mocks.findExistingFeedForUserByUrl.mockResolvedValue(null);
    mocks.parseFeedWithMetadata.mockImplementation(async (url: string) => ({
      parsedFeed: {
        title: "Parsed Feed",
        description: "Parsed",
        items: [],
      },
      etag: null,
      lastModified: null,
      resolvedUrl: url,
    }));
    mocks.createFeedWithInitialItems.mockImplementation(
      async (_userId: string, url: string, _parsedFeed: unknown, folderIds: string[]) => ({
        feed: {
          id: url.includes("one") ? "feed_one" : "feed_two",
          folderId: folderIds[0] || null,
        },
        insertedItems: 0,
      })
    );
    mocks.createFolderForUser.mockResolvedValue({
      status: "ok",
      folder: {
        id: "folder_shared",
        name: "Shared",
        createdAt: new Date("2026-02-11T00:00:00.000Z"),
        updatedAt: new Date("2026-02-11T00:00:00.000Z"),
      },
    });

    const response = await POST(
      createImportRequest({
        sourceType: "JSON",
        entries: [
          {
            url: "https://one.example.com/feed.xml",
            folderNames: ["Shared"],
            customTitle: null,
          },
          {
            url: "https://two.example.com/feed.xml",
            folderNames: ["Shared"],
            customTitle: null,
          },
        ],
      })
    );
    const body = (await response.json()) as { importedCount: number };

    expect(response.status).toBe(200);
    expect(body.importedCount).toBe(2);
    expect(mocks.createFolderForUser).toHaveBeenCalledTimes(1);
    expect(mocks.createFeedWithInitialItems).toHaveBeenNthCalledWith(
      1,
      "user_123",
      "https://one.example.com/feed.xml",
      expect.any(Object),
      ["folder_shared"],
      {
        etag: null,
        lastModified: null,
      }
    );
    expect(mocks.createFeedWithInitialItems).toHaveBeenNthCalledWith(
      2,
      "user_123",
      "https://two.example.com/feed.xml",
      expect.any(Object),
      ["folder_shared"],
      {
        etag: null,
        lastModified: null,
      }
    );
  });

  it("returns 413 when payload exceeds max request bytes", async () => {
    const response = await POST(
      createImportRequest(
        JSON.stringify({
          sourceType: "JSON",
          entries: [{ url: "https://example.com/feed.xml", folderNames: [], customTitle: null }],
        }),
        {
          headers: {
            "Content-Length": "1000001",
          },
        }
      )
    );
    const body = (await response.json()) as { code?: string };

    expect(response.status).toBe(413);
    expect(body.code).toBe("payload_too_large");
  });

  it("returns invalid_payload when entries are empty", async () => {
    const response = await POST(
      createImportRequest({
        sourceType: "JSON",
        entries: [],
      })
    );
    const body = (await response.json()) as { code?: string; error?: string };

    expect(response.status).toBe(400);
    expect(body.code).toBe("invalid_payload");
    expect(body.error).toContain("entries must include at least one entry");
  });

  it("returns invalid_payload for overlong URL values", async () => {
    const response = await POST(
      createImportRequest({
        sourceType: "JSON",
        entries: [
          {
            url: `https://example.com/${"a".repeat(2100)}`,
            folderNames: [],
            customTitle: null,
          },
        ],
      })
    );
    const body = (await response.json()) as { code?: string; error?: string };

    expect(response.status).toBe(400);
    expect(body.code).toBe("invalid_payload");
    expect(body.error).toContain("at most 2048 characters");
  });

  it("returns entry_limit_exceeded when request entries exceed max per request", async () => {
    const response = await POST(
      createImportRequest({
        sourceType: "JSON",
        entries: Array.from({ length: 51 }, (_, index) => ({
          url: `https://example.com/${index}.xml`,
          folderNames: [],
          customTitle: null,
        })),
      })
    );
    const body = (await response.json()) as { code?: string };

    expect(response.status).toBe(400);
    expect(body.code).toBe("entry_limit_exceeded");
  });

  it("returns timeout_budget_exceeded rows when request budget is exhausted", async () => {
    const nowSpy = vi.spyOn(Date, "now");
    let nowCallCount = 0;
    nowSpy.mockImplementation(() => {
      nowCallCount += 1;
      if (nowCallCount <= 2) {
        return 0;
      }
      return 46_000;
    });

    const response = await POST(
      createImportRequest({
        sourceType: "JSON",
        entries: [{ url: "https://example.com/feed.xml", folderNames: [], customTitle: null }],
      })
    );
    const body = (await response.json()) as {
      rows: Array<{ status: string; code?: string }>;
      failedCount: number;
    };

    nowSpy.mockRestore();

    expect(response.status).toBe(200);
    expect(body.failedCount).toBe(1);
    expect(body.rows[0]).toMatchObject({
      status: "failed",
      code: "timeout_budget_exceeded",
    });
  });

  it("merges duplicate folder assignments additively across repeated duplicate rows", async () => {
    mocks.findExistingFeedForUserByUrl.mockResolvedValue({
      id: "feed_existing",
      folderId: null,
    });
    mocks.createFolderForUser.mockImplementation(async (_userId: string, name: string) => ({
      status: "ok",
      folder: {
        id: name === "Alpha" ? "folder_alpha" : "folder_beta",
        name,
        createdAt: new Date("2026-02-11T00:00:00.000Z"),
        updatedAt: new Date("2026-02-11T00:00:00.000Z"),
      },
    }));
    mocks.addFeedFoldersForUser.mockImplementation(
      async (_userId: string, _feedId: string, folderIds: string[]) => {
        const isAlpha = folderIds.includes("folder_alpha");
        return {
          status: "ok",
          addedFolderIds: [isAlpha ? "folder_alpha" : "folder_beta"],
          folderIds: isAlpha
            ? ["folder_alpha"]
            : ["folder_alpha", "folder_beta"],
        };
      }
    );

    const response = await POST(
      createImportRequest({
        sourceType: "JSON",
        entries: [
          {
            url: "https://existing.example.com/feed.xml",
            folderNames: ["Alpha"],
            customTitle: null,
          },
          {
            url: "https://existing.example.com/feed.xml",
            folderNames: ["Beta"],
            customTitle: null,
          },
        ],
      })
    );
    const body = (await response.json()) as {
      rows: Array<{ status: string }>;
      mergedCount: number;
      duplicateCount: number;
    };

    expect(response.status).toBe(200);
    expect(body.mergedCount).toBe(2);
    expect(body.duplicateCount).toBe(2);
    expect(body.rows[0].status).toBe("duplicate_merged");
    expect(body.rows[1].status).toBe("duplicate_merged");
    expect(mocks.addFeedFoldersForUser).toHaveBeenCalledTimes(2);
    expect(mocks.addFeedFoldersForUser).toHaveBeenCalledWith(
      "user_123",
      "feed_existing",
      ["folder_alpha"]
    );
    expect(mocks.addFeedFoldersForUser).toHaveBeenCalledWith(
      "user_123",
      "feed_existing",
      ["folder_beta"]
    );
  });

  it("returns 429 when rate limit is exceeded", async () => {
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
            "Retry-After": "5",
          },
        }
      ),
    });

    const response = await POST(
      createImportRequest({
        sourceType: "JSON",
        entries: [{ url: "https://one.example.com/feed.xml", folderNames: [], customTitle: null }],
      })
    );
    const body = await response.json();

    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBe("5");
    expect(body.code).toBe("rate_limited");
  });
});
