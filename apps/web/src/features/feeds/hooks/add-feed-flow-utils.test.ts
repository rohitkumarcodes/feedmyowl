import { describe, expect, it } from "vitest";
import type { FeedViewModel } from "@/features/feeds/types/view-models";
import {
  getInlineDuplicateMessage,
  mergeExistingFeedPatch,
  resolveExistingFeedTargetId,
  shouldBlockExactDuplicateAdd,
} from "./add-feed-flow-utils";

function buildFeed(overrides: Partial<FeedViewModel> = {}): FeedViewModel {
  return {
    id: "feed_1",
    title: "Original title",
    customTitle: "Custom title",
    description: "Original description",
    url: "https://example.com/feed.xml",
    folderIds: ["folder_a"],
    lastFetchedAt: "2026-02-10T00:00:00.000Z",
    lastFetchStatus: "error",
    lastFetchErrorCode: "http_500",
    lastFetchErrorMessage: "Server error",
    lastFetchErrorAt: "2026-02-10T01:00:00.000Z",
    createdAt: "2026-02-01T00:00:00.000Z",
    items: [],
    ...overrides,
  };
}

describe("add-feed-flow-utils", () => {
  it("blocks exact duplicate submit when no folders are selected", () => {
    expect(
      shouldBlockExactDuplicateAdd({
        isExactDuplicate: true,
        selectedFolderIds: [],
      }),
    ).toBe(true);
  });

  it("allows exact duplicate submit when at least one folder is selected", () => {
    expect(
      shouldBlockExactDuplicateAdd({
        isExactDuplicate: true,
        selectedFolderIds: ["folder_a"],
      }),
    ).toBe(false);
  });

  it("returns contextual duplicate messaging based on selected folders", () => {
    expect(
      getInlineDuplicateMessage({
        isExactDuplicate: true,
        selectedFolderIds: [],
      }),
    ).toBe("This feed is already in your library.");

    expect(
      getInlineDuplicateMessage({
        isExactDuplicate: true,
        selectedFolderIds: ["folder_a"],
      }),
    ).toBe("This feed is already in your library. Add it to update folder assignments.");
  });

  it("prefers existingFeedId lookup when available for open-existing", () => {
    const targetId = resolveExistingFeedTargetId({
      url: "https://example.com/comments.xml",
      existingFeedId: "feed_existing",
      knownFeedIds: new Set(["feed_existing"]),
      feedIdByNormalizedUrl: new Map([["https://example.com/feed.xml", "feed_1"]]),
    });

    expect(targetId).toBe("feed_existing");
  });

  it("falls back to normalized URL lookup for open-existing", () => {
    const targetId = resolveExistingFeedTargetId({
      url: "example.com/feed.xml",
      existingFeedId: null,
      knownFeedIds: new Set(["feed_1"]),
      feedIdByNormalizedUrl: new Map([["https://example.com/feed.xml", "feed_1"]]),
    });

    expect(targetId).toBe("feed_1");
  });

  it("applies explicit null server fields when merging existing feed patches", () => {
    const merged = mergeExistingFeedPatch(buildFeed(), {
      id: "feed_1",
      url: "https://example.com/feed.xml",
      title: null,
      customTitle: null,
      description: null,
      lastFetchStatus: null,
      lastFetchErrorCode: null,
      lastFetchErrorMessage: null,
      lastFetchErrorAt: null,
      folderIds: [],
    });

    expect(merged.title).toBeNull();
    expect(merged.customTitle).toBeNull();
    expect(merged.description).toBeNull();
    expect(merged.lastFetchStatus).toBeNull();
    expect(merged.lastFetchErrorCode).toBeNull();
    expect(merged.lastFetchErrorMessage).toBeNull();
    expect(merged.lastFetchErrorAt).toBeNull();
    expect(merged.folderIds).toEqual([]);
  });

  it("preserves current fields when the server patch omits them", () => {
    const merged = mergeExistingFeedPatch(buildFeed(), {
      id: "feed_1",
      url: "https://example.com/feed.xml",
    });

    expect(merged.title).toBe("Original title");
    expect(merged.customTitle).toBe("Custom title");
    expect(merged.description).toBe("Original description");
    expect(merged.folderIds).toEqual(["folder_a"]);
  });
});
