import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  isRetentionPurgeNeeded: vi.fn(),
  purgeOldFeedItems: vi.fn(),
  dbQueryFeedsFindMany: vi.fn(),
  dbQueryFoldersFindMany: vi.fn(),
  handleApiRouteError: vi.fn(),
}));

vi.mock("@/lib/server/retention", () => ({
  isRetentionPurgeNeeded: mocks.isRetentionPurgeNeeded,
  purgeOldFeedItems: mocks.purgeOldFeedItems,
}));

vi.mock("@/lib/server/database", () => ({
  db: {
    query: {
      feeds: {
        findMany: mocks.dbQueryFeedsFindMany,
      },
      folders: {
        findMany: mocks.dbQueryFoldersFindMany,
      },
    },
  },
}));

vi.mock("@/lib/server/api-errors", () => ({
  handleApiRouteError: mocks.handleApiRouteError,
}));

import { getFeedsRoute } from "@/app/api/feeds/route.get";

describe("GET /api/feeds", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.isRetentionPurgeNeeded.mockResolvedValue(false);
    mocks.dbQueryFeedsFindMany.mockResolvedValue([]);
    mocks.dbQueryFoldersFindMany.mockResolvedValue([]);
    mocks.handleApiRouteError.mockImplementation(
      () => new Response(JSON.stringify({ error: "Unexpected error" }), { status: 500 }),
    );
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("returns empty feeds and folders", async () => {
    const response = await getFeedsRoute();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ feeds: [], folders: [] });
  });
});
