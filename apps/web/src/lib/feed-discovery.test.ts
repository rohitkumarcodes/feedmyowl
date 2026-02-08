import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { discoverFeedCandidates } from "@/lib/feed-discovery";

describe("discoverFeedCandidates", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("extracts an alternate feed URL and filters comment feeds", async () => {
    fetchMock.mockResolvedValue(
      new Response(
        `
          <html>
            <head>
              <link rel="alternate" type="application/rss+xml" title="Main Feed" href="/feed.xml" />
              <link rel="alternate" type="application/rss+xml" title="Comments Feed" href="/comments/feed.xml" />
            </head>
          </html>
        `,
        { status: 200, headers: { "content-type": "text/html" } }
      )
    );

    const result = await discoverFeedCandidates("https://news.example.com/blog");

    expect(result.candidates[0]).toBe("https://news.example.com/feed.xml");
    expect(result.methodHints["https://news.example.com/feed.xml"]).toBe("html_alternate");
    expect(result.candidates).not.toContain("https://news.example.com/comments/feed.xml");
    expect(result.candidates.length).toBeLessThanOrEqual(5);
  });

  it("falls back to heuristic feed paths when no alternates are present", async () => {
    fetchMock.mockResolvedValue(
      new Response("<html><head></head><body>No feeds listed</body></html>", {
        status: 200,
        headers: { "content-type": "text/html" },
      })
    );

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
});
