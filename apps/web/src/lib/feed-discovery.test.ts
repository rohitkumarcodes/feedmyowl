import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  fetchRemoteText: vi.fn(),
}));

vi.mock("@/lib/feed-fetcher", () => ({
  fetchRemoteText: mocks.fetchRemoteText,
}));

import { discoverFeedCandidates } from "@/lib/feed-discovery";

describe("discoverFeedCandidates", () => {
  beforeEach(() => {
    mocks.fetchRemoteText.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("extracts an alternate feed URL and filters comment feeds", async () => {
    mocks.fetchRemoteText.mockResolvedValue({
      status: "ok",
      text: `
        <html>
          <head>
            <link rel="alternate" type="application/rss+xml" title="Main Feed" href="/feed.xml" />
            <link rel="alternate" type="application/rss+xml" title="Comments Feed" href="/comments/feed.xml" />
          </head>
        </html>
      `,
      etag: null,
      lastModified: null,
      finalUrl: "https://news.example.com/blog",
      statusCode: 200,
    });

    const result = await discoverFeedCandidates("https://news.example.com/blog");

    expect(result.candidates[0]).toBe("https://news.example.com/feed.xml");
    expect(result.methodHints["https://news.example.com/feed.xml"]).toBe("html_alternate");
    expect(result.candidates).not.toContain("https://news.example.com/comments/feed.xml");
    expect(result.candidates.length).toBeLessThanOrEqual(5);
  });

  it("falls back to heuristic feed paths when no alternates are present", async () => {
    mocks.fetchRemoteText.mockResolvedValue({
      status: "ok",
      text: "<html><head></head><body>No feeds listed</body></html>",
      etag: null,
      lastModified: null,
      finalUrl: "https://site.example.com/some/path",
      statusCode: 200,
    });

    const result = await discoverFeedCandidates("https://site.example.com/some/path");

    expect(result.candidates).toEqual([
      "https://site.example.com/feed",
      "https://site.example.com/feed.xml",
      "https://site.example.com/rss",
      "https://site.example.com/rss.xml",
      "https://site.example.com/atom.xml",
    ]);

    for (const candidate of result.candidates) {
      expect(result.methodHints[candidate]).toBe("heuristic_path");
    }
  });

  it("dedupes alternates and keeps the first discovery method hint", async () => {
    mocks.fetchRemoteText.mockResolvedValue({
      status: "ok",
      text: `
        <html>
          <head>
            <link rel="alternate" type="application/rss+xml" title="Main feed" href="/feed" />
          </head>
        </html>
      `,
      etag: null,
      lastModified: null,
      finalUrl: "https://site.example.com/blog",
      statusCode: 200,
    });

    const result = await discoverFeedCandidates("https://site.example.com/blog");

    expect(result.candidates).toEqual([
      "https://site.example.com/feed",
      "https://site.example.com/feed.xml",
      "https://site.example.com/rss",
      "https://site.example.com/rss.xml",
      "https://site.example.com/atom.xml",
    ]);
    expect(result.methodHints["https://site.example.com/feed"]).toBe("html_alternate");
    expect(Object.keys(result.methodHints)).toHaveLength(result.candidates.length);
  });

  it("falls back to www host candidates when the non-www host is unreachable", async () => {
    mocks.fetchRemoteText
      .mockRejectedValueOnce(new Error("Unable to resolve host"))
      .mockResolvedValueOnce({
        status: "ok",
        text: "<html><head></head><body>No feeds listed</body></html>",
        etag: null,
        lastModified: null,
        finalUrl: "https://www.site.example.com/",
        statusCode: 200,
      });

    const result = await discoverFeedCandidates("https://site.example.com");

    expect(result.candidates).toEqual([
      "https://www.site.example.com/feed",
      "https://www.site.example.com/feed.xml",
      "https://www.site.example.com/rss",
      "https://www.site.example.com/rss.xml",
      "https://www.site.example.com/atom.xml",
    ]);

    for (const candidate of result.candidates) {
      expect(result.methodHints[candidate]).toBe("heuristic_path");
    }
  });
});
