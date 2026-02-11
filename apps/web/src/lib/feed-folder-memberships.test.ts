import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  dbQueryFeedFolderMembershipsFindMany: vi.fn(),
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
}));

import {
  getFeedFolderIdsForUserFeed,
  getFeedFolderIdsMapForUserFeeds,
} from "@/lib/feed-folder-memberships";

describe("feed-folder-membership queries", () => {
  beforeEach(() => {
    mocks.dbQueryFeedFolderMembershipsFindMany.mockReset();
  });

  it("loads normalized folder IDs for one feed", async () => {
    mocks.dbQueryFeedFolderMembershipsFindMany.mockResolvedValue([
      { folderId: "folder-b" },
      { folderId: "folder-a" },
      { folderId: "folder-a" },
    ]);

    const folderIds = await getFeedFolderIdsForUserFeed("user_1", "feed_1");

    expect(folderIds).toEqual(["folder-a", "folder-b"]);
  });

  it("builds per-feed folder maps", async () => {
    mocks.dbQueryFeedFolderMembershipsFindMany.mockResolvedValue([
      { feedId: "feed_1", folderId: "folder-b" },
      { feedId: "feed_1", folderId: "folder-a" },
      { feedId: "feed_2", folderId: "folder-z" },
    ]);

    const folderMap = await getFeedFolderIdsMapForUserFeeds({
      userId: "user_1",
      feedIds: ["feed_1", "feed_2"],
    });

    expect(folderMap.get("feed_1")).toEqual(["folder-a", "folder-b"]);
    expect(folderMap.get("feed_2")).toEqual(["folder-z"]);
  });
});
