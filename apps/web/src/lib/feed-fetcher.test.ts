import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockLookup = vi.hoisted(() => vi.fn());
const mockCaptureMessage = vi.hoisted(() => vi.fn());

vi.mock("node:dns/promises", () => ({
  lookup: mockLookup,
}));

vi.mock("@/lib/error-tracking", () => ({
  captureMessage: mockCaptureMessage,
}));

import { fetchFeedXml } from "@/lib/feed-fetcher";

describe("fetchFeedXml", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
    mockCaptureMessage.mockReset();
    mockLookup.mockReset();
    mockLookup.mockResolvedValue([
      {
        address: "93.184.216.34",
        family: 4,
      },
    ]);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("blocks direct private IP requests", async () => {
    await expect(
      fetchFeedXml("http://127.0.0.1/feed.xml", {
        retries: 0,
      })
    ).rejects.toThrow(/blocked/i);

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("retries transient 5xx failures and succeeds", async () => {
    fetchMock
      .mockResolvedValueOnce(new Response("upstream error", { status: 500 }))
      .mockResolvedValueOnce(
        new Response("<rss><channel><title>OK</title></channel></rss>", {
          status: 200,
          headers: {
            etag: "\"etag-123\"",
            "last-modified": "Wed, 11 Feb 2026 00:00:00 GMT",
          },
        })
      );

    const result = await fetchFeedXml("https://example.com/feed.xml", {
      retries: 1,
      timeoutMs: 500,
    });

    expect(result.status).toBe("ok");
    expect(result.text).toContain("<rss>");
    expect(result.etag).toBe("\"etag-123\"");
    expect(result.lastModified).toBe("Wed, 11 Feb 2026 00:00:00 GMT");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("returns not_modified for HTTP 304 responses", async () => {
    fetchMock.mockResolvedValue(
      new Response(null, {
        status: 304,
        headers: {
          etag: "\"etag-new\"",
          "last-modified": "Wed, 11 Feb 2026 00:00:00 GMT",
        },
      })
    );

    const result = await fetchFeedXml("https://example.com/feed.xml", {
      retries: 0,
      etag: "\"etag-old\"",
      lastModified: "Tue, 10 Feb 2026 00:00:00 GMT",
    });

    expect(result.status).toBe("not_modified");
    expect(result.etag).toBe("\"etag-new\"");
    expect(result.lastModified).toBe("Wed, 11 Feb 2026 00:00:00 GMT");
  });

  it("blocks redirects that resolve to local/private endpoints", async () => {
    fetchMock.mockResolvedValue(
      new Response(null, {
        status: 302,
        headers: {
          location: "http://169.254.169.254/latest/meta-data",
        },
      })
    );

    await expect(
      fetchFeedXml("https://example.com/feed.xml", {
        retries: 0,
      })
    ).rejects.toThrow(/blocked/i);

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
