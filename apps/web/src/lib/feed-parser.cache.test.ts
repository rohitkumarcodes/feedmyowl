import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  fetchFeedXml: vi.fn(),
}));

vi.mock("@/lib/server/feed-fetcher", () => ({
  fetchFeedXml: mocks.fetchFeedXml,
}));

import { parseFeedWithCache } from "@/lib/server/feed-parser";

describe("parseFeedWithCache", () => {
  it("returns not_modified without parsing when upstream returns 304", async () => {
    mocks.fetchFeedXml.mockResolvedValue({
      status: "not_modified",
      etag: '"etag-304"',
      lastModified: "Wed, 11 Feb 2026 00:00:00 GMT",
      finalUrl: "https://example.com/feed.xml",
      statusCode: 304,
    });

    const result = await parseFeedWithCache("https://example.com/feed.xml", {
      etag: '"etag-old"',
    });

    expect(result.status).toBe("not_modified");
    if (result.status === "not_modified") {
      expect(result.etag).toBe('"etag-304"');
    }
  });

  it("parses returned XML when upstream returns content", async () => {
    mocks.fetchFeedXml.mockResolvedValue({
      status: "ok",
      text: `<?xml version="1.0"?><rss version="2.0"><channel><title>Example</title><item><guid>abc</guid><title>Entry</title><link>https://example.com/post</link></item></channel></rss>`,
      etag: '"etag-200"',
      lastModified: "Wed, 11 Feb 2026 00:00:00 GMT",
      finalUrl: "https://example.com/feed.xml",
      statusCode: 200,
    });

    const result = await parseFeedWithCache("https://example.com/feed.xml");

    expect(result.status).toBe("ok");
    if (result.status === "ok") {
      expect(result.parsedFeed.title).toBe("Example");
      expect(result.parsedFeed.items[0]?.guid).toBe("abc");
      expect(result.etag).toBe('"etag-200"');
    }
  });
});
