import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getAppUser: vi.fn(),
  isUserRetentionPurgeNeeded: vi.fn(),
  purgeOldFeedItemsForUser: vi.fn(),
  dbQueryUsersFindFirst: vi.fn(),
  eq: vi.fn(),
  handleApiRouteError: vi.fn(),
}));

vi.mock("./route.shared", () => ({
  getAppUser: mocks.getAppUser,
}));

vi.mock("@/lib/retention", () => ({
  isUserRetentionPurgeNeeded: mocks.isUserRetentionPurgeNeeded,
  purgeOldFeedItemsForUser: mocks.purgeOldFeedItemsForUser,
}));

vi.mock("@/lib/database", () => ({
  db: {
    query: {
      users: {
        findFirst: mocks.dbQueryUsersFindFirst,
      },
    },
  },
  eq: mocks.eq,
  users: {},
}));

vi.mock("@/lib/api-errors", () => ({
  handleApiRouteError: mocks.handleApiRouteError,
}));

import { getFeedsRoute } from "@/app/api/feeds/route.get";

describe("GET /api/feeds retention guard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getAppUser.mockResolvedValue({ id: "user_123", clerkId: "clerk_123" });
    mocks.isUserRetentionPurgeNeeded.mockResolvedValue(false);
    mocks.dbQueryUsersFindFirst.mockResolvedValue({
      folders: [],
      feeds: [],
    });
    mocks.eq.mockReturnValue(Symbol("eq"));
    mocks.handleApiRouteError.mockImplementation(() =>
      new Response(JSON.stringify({ error: "Unexpected error" }), { status: 500 })
    );
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("skips purge when no feed exceeds the retention cap", async () => {
    const response = await getFeedsRoute();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ feeds: [], folders: [] });
    expect(mocks.isUserRetentionPurgeNeeded).toHaveBeenCalledWith("user_123");
    expect(mocks.purgeOldFeedItemsForUser).not.toHaveBeenCalled();
  });

  it("runs purge when at least one feed exceeds the retention cap", async () => {
    mocks.isUserRetentionPurgeNeeded.mockResolvedValue(true);
    mocks.purgeOldFeedItemsForUser.mockResolvedValue(3);

    const response = await getFeedsRoute();

    expect(response.status).toBe(200);
    expect(mocks.isUserRetentionPurgeNeeded).toHaveBeenCalledWith("user_123");
    expect(mocks.purgeOldFeedItemsForUser).toHaveBeenCalledTimes(1);
    expect(mocks.purgeOldFeedItemsForUser).toHaveBeenCalledWith("user_123");
  });
});
