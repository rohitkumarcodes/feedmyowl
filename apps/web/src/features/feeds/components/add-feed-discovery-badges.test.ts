import { describe, expect, it } from "vitest";
import {
  getDiscoveryBadgeFlags,
  isLikelyCommentsFeedCandidate,
} from "./add-feed-discovery-badges";

describe("add-feed discovery badges", () => {
  it("marks recommended only when there is exactly one addable candidate", () => {
    expect(
      getDiscoveryBadgeFlags({
        candidate: {
          url: "https://example.com/feed.xml",
          title: "Main feed",
          duplicate: false,
        },
        addableCandidateCount: 1,
      }).recommended,
    ).toBe(true);

    expect(
      getDiscoveryBadgeFlags({
        candidate: {
          url: "https://example.com/feed.xml",
          title: "Main feed",
          duplicate: false,
        },
        addableCandidateCount: 2,
      }).recommended,
    ).toBe(false);
  });

  it("marks duplicate candidates as already in library", () => {
    const flags = getDiscoveryBadgeFlags({
      candidate: {
        url: "https://example.com/feed.xml",
        title: "Main feed",
        duplicate: true,
      },
      addableCandidateCount: 0,
    });

    expect(flags.alreadyInLibrary).toBe(true);
    expect(flags.recommended).toBe(false);
  });

  it("detects likely comments feeds from URL/title keywords", () => {
    expect(
      isLikelyCommentsFeedCandidate({
        url: "https://blog.example.com/comments/feed.xml",
        title: "Comments RSS",
      }),
    ).toBe(true);

    expect(
      isLikelyCommentsFeedCandidate({
        url: "https://blog.example.com/main-feed.xml",
        title: "Posts",
      }),
    ).toBe(false);
  });
});
