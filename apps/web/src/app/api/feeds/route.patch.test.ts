import type { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  dbDelete: vi.fn(),
  eq: vi.fn(),
  deleteAuthUser: vi.fn(),
  handleApiRouteError: vi.fn(),
  assertTrustedWriteOrigin: vi.fn(),
  deleteUncategorizedFeedsForUser: vi.fn(),
  moveUncategorizedFeedsToFolderForUser: vi.fn(),
  markFeedItemReadForUser: vi.fn(),
  getAppUser: vi.fn(),
  parseRouteJson: vi.fn(),
}));

vi.mock("@/lib/server/database", () => ({
  db: {
    delete: mocks.dbDelete,
  },
  eq: mocks.eq,
  users: {},
}));

vi.mock("@/lib/server/auth", () => ({
  deleteAuthUser: mocks.deleteAuthUser,
  isAuthRequiredError: vi.fn(() => false),
}));

vi.mock("@/lib/server/api-errors", () => ({
  handleApiRouteError: mocks.handleApiRouteError,
}));

vi.mock("@/lib/server/csrf", () => ({
  assertTrustedWriteOrigin: mocks.assertTrustedWriteOrigin,
}));

vi.mock("@/lib/server/feed-service", () => ({
  deleteUncategorizedFeedsForUser: mocks.deleteUncategorizedFeedsForUser,
  moveUncategorizedFeedsToFolderForUser: mocks.moveUncategorizedFeedsToFolderForUser,
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
    mocks.handleApiRouteError.mockImplementation(
      () => new Response(JSON.stringify({ error: "Unexpected error" }), { status: 500 }),
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

describe("PATCH /api/feeds uncategorized.move_to_folder", () => {
  beforeEach(() => {
    mocks.assertTrustedWriteOrigin.mockReturnValue(null);
    mocks.getAppUser.mockResolvedValue({ id: "user_123", clerkId: "clerk_123" });
    mocks.handleApiRouteError.mockImplementation(
      () => new Response(JSON.stringify({ error: "Unexpected error" }), { status: 500 }),
    );
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("returns 400 when folderId is missing", async () => {
    mocks.parseRouteJson.mockResolvedValue({
      action: "uncategorized.move_to_folder",
    });

    const response = await patchFeedsRoute(createPatchRequest({}));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toMatchObject({
      error: "Folder ID is required.",
      code: "invalid_folder_id",
    });
    expect(mocks.moveUncategorizedFeedsToFolderForUser).not.toHaveBeenCalled();
  });

  it("returns 400 when folder does not exist", async () => {
    mocks.parseRouteJson.mockResolvedValue({
      action: "uncategorized.move_to_folder",
      folderId: "folder_missing",
    });
    mocks.moveUncategorizedFeedsToFolderForUser.mockResolvedValue({
      status: "invalid_folder_id",
    });

    const response = await patchFeedsRoute(createPatchRequest({}));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toMatchObject({
      error: "Selected folder could not be found.",
      code: "invalid_folder_id",
    });
  });

  it("returns best-effort move counts", async () => {
    mocks.parseRouteJson.mockResolvedValue({
      action: "uncategorized.move_to_folder",
      folderId: "folder_123",
    });
    mocks.moveUncategorizedFeedsToFolderForUser.mockResolvedValue({
      status: "ok",
      totalUncategorizedCount: 6,
      movedFeedCount: 4,
      failedFeedCount: 2,
    });

    const response = await patchFeedsRoute(createPatchRequest({}));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      success: true,
      totalUncategorizedCount: 6,
      movedFeedCount: 4,
      failedFeedCount: 2,
    });
    expect(mocks.moveUncategorizedFeedsToFolderForUser).toHaveBeenCalledWith(
      "user_123",
      "folder_123",
    );
  });
});
