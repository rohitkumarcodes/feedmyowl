import type { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  dbDelete: vi.fn(),
  eq: vi.fn(),
  deleteAuthUser: vi.fn(),
  handleApiRouteError: vi.fn(),
  assertTrustedWriteOrigin: vi.fn(),
  deleteUncategorizedFeedsForUser: vi.fn(),
  markFeedItemReadForUser: vi.fn(),
  getAppUser: vi.fn(),
  parseRouteJson: vi.fn(),
}));

vi.mock("@/lib/database", () => ({
  db: {
    delete: mocks.dbDelete,
  },
  eq: mocks.eq,
  users: {},
}));

vi.mock("@/lib/auth", () => ({
  deleteAuthUser: mocks.deleteAuthUser,
}));

vi.mock("@/lib/api-errors", () => ({
  handleApiRouteError: mocks.handleApiRouteError,
}));

vi.mock("@/lib/csrf", () => ({
  assertTrustedWriteOrigin: mocks.assertTrustedWriteOrigin,
}));

vi.mock("@/lib/feed-service", () => ({
  deleteUncategorizedFeedsForUser: mocks.deleteUncategorizedFeedsForUser,
  markFeedItemReadForUser: mocks.markFeedItemReadForUser,
}));

vi.mock("./route.shared", () => ({
  getAppUser: mocks.getAppUser,
  parseRouteJson: mocks.parseRouteJson,
}));

import { patchFeedsRoute } from "@/app/api/feeds/route.patch";

function createPatchRequest(body: Record<string, unknown>): NextRequest {
  return new Request("https://app.feedmyowl.test/api/feeds", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }) as NextRequest;
}

describe("PATCH /api/feeds uncategorized.delete", () => {
  beforeEach(() => {
    mocks.assertTrustedWriteOrigin.mockReturnValue(null);
    mocks.getAppUser.mockResolvedValue({ id: "user_123", clerkId: "clerk_123" });
    mocks.parseRouteJson.mockResolvedValue({
      action: "uncategorized.delete",
      confirm: true,
    });
    mocks.deleteUncategorizedFeedsForUser.mockResolvedValue(2);
    mocks.handleApiRouteError.mockImplementation(() =>
      new Response(JSON.stringify({ error: "Unexpected error" }), { status: 500 })
    );
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("returns 400 when confirm is missing", async () => {
    mocks.parseRouteJson.mockResolvedValue({
      action: "uncategorized.delete",
    });

    const response = await patchFeedsRoute(createPatchRequest({}));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe("Uncategorized deletion must be explicitly confirmed.");
    expect(mocks.deleteUncategorizedFeedsForUser).not.toHaveBeenCalled();
  });

  it("returns 400 when confirm is false", async () => {
    mocks.parseRouteJson.mockResolvedValue({
      action: "uncategorized.delete",
      confirm: false,
    });

    const response = await patchFeedsRoute(createPatchRequest({}));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe("Uncategorized deletion must be explicitly confirmed.");
    expect(mocks.deleteUncategorizedFeedsForUser).not.toHaveBeenCalled();
  });

  it("deletes uncategorized feeds when confirm is true", async () => {
    mocks.parseRouteJson.mockResolvedValue({
      action: "uncategorized.delete",
      confirm: true,
    });
    mocks.deleteUncategorizedFeedsForUser.mockResolvedValue(3);

    const response = await patchFeedsRoute(createPatchRequest({}));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      success: true,
      deletedFeedCount: 3,
    });
    expect(mocks.deleteUncategorizedFeedsForUser).toHaveBeenCalledWith("user_123");
  });
});
