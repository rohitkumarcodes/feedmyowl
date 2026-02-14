import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  fetchRemoteText: vi.fn(),
}));

vi.mock("@/lib/feed-fetcher", () => ({
  fetchRemoteText: mocks.fetchRemoteText,
}));

import { resolveYouTubeChannelFeedUrl } from "@/lib/youtube-channel-feed";

describe("resolveYouTubeChannelFeedUrl", () => {
  beforeEach(() => {
    mocks.fetchRemoteText.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("returns null for non-YouTube hostnames without fetching", async () => {
    await expect(resolveYouTubeChannelFeedUrl("https://example.com")).resolves.toBe(null);
    expect(mocks.fetchRemoteText).not.toHaveBeenCalled();
  });

  it("rewrites /channel/ URLs without fetching HTML", async () => {
    const channelId = "UCaaaaaaaaaaaaaaaaaaaaaa";
    const input = `https://www.youtube.com/channel/${channelId}/videos`;

    await expect(resolveYouTubeChannelFeedUrl(input)).resolves.toBe(
      `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`
    );
    expect(mocks.fetchRemoteText).not.toHaveBeenCalled();
  });

  it("scrapes @handle pages to derive channel_id feed URL", async () => {
    const channelId = "UCaaaaaaaaaaaaaaaaaaaaaa";
    const input = "https://www.youtube.com/@somehandle";

    mocks.fetchRemoteText.mockResolvedValue({
      status: "ok",
      text: `<link rel="canonical" href="https://www.youtube.com/channel/${channelId}" />`,
      etag: null,
      lastModified: null,
      finalUrl: input,
      statusCode: 200,
    });

    await expect(resolveYouTubeChannelFeedUrl(input)).resolves.toBe(
      `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`
    );

    expect(mocks.fetchRemoteText).toHaveBeenCalledWith(input, {
      timeoutMs: 7_000,
      retries: 0,
      maxRedirects: 5,
      accept: "text/html,application/xhtml+xml;q=0.9,text/plain;q=0.8,*/*;q=0.1",
    });
  });
});

