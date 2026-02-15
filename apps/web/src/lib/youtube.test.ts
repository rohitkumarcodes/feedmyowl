import { describe, expect, it } from "vitest";
import {
  extractYouTubeChannelIdFromHtml,
  extractYouTubeChannelIdFromUrl,
  extractYouTubeVideoId,
} from "@/lib/shared/youtube";

describe("youtube helpers", () => {
  describe("extractYouTubeVideoId", () => {
    it("parses watch URLs", () => {
      expect(extractYouTubeVideoId("https://www.youtube.com/watch?v=dQw4w9WgXcQ")).toBe(
        "dQw4w9WgXcQ",
      );

      expect(
        extractYouTubeVideoId("https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=10s"),
      ).toBe("dQw4w9WgXcQ");
    });

    it("parses youtu.be URLs", () => {
      expect(extractYouTubeVideoId("https://youtu.be/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
    });

    it("parses shorts URLs", () => {
      expect(extractYouTubeVideoId("https://www.youtube.com/shorts/dQw4w9WgXcQ")).toBe(
        "dQw4w9WgXcQ",
      );
    });

    it("rejects non-YouTube URLs and invalid ids", () => {
      expect(extractYouTubeVideoId("https://example.com/watch?v=dQw4w9WgXcQ")).toBe(null);
      expect(extractYouTubeVideoId("https://www.youtube.com/watch?v=notvalid")).toBe(
        null,
      );
    });
  });

  describe("extractYouTubeChannelIdFromUrl", () => {
    const channelId = "UCaaaaaaaaaaaaaaaaaaaaaa";

    it("parses /channel/ URLs", () => {
      expect(
        extractYouTubeChannelIdFromUrl(`https://www.youtube.com/channel/${channelId}`),
      ).toBe(channelId);
    });

    it("parses /channel/ URLs with suffix paths", () => {
      expect(
        extractYouTubeChannelIdFromUrl(
          `https://www.youtube.com/channel/${channelId}/videos`,
        ),
      ).toBe(channelId);
    });

    it("rejects non-YouTube and invalid channel ids", () => {
      expect(
        extractYouTubeChannelIdFromUrl(`https://example.com/channel/${channelId}`),
      ).toBe(null);
      expect(
        extractYouTubeChannelIdFromUrl(
          "https://www.youtube.com/channel/ZZaaaaaaaaaaaaaaaaaaaaaa",
        ),
      ).toBe(null);
    });
  });

  describe("extractYouTubeChannelIdFromHtml", () => {
    const channelId = "UCaaaaaaaaaaaaaaaaaaaaaa";

    it("extracts channel id from canonical link", () => {
      const html = `
        <html>
          <head>
            <link rel="canonical" href="https://www.youtube.com/channel/${channelId}" />
          </head>
        </html>
      `;

      expect(extractYouTubeChannelIdFromHtml(html)).toBe(channelId);
    });

    it("extracts channel id from channel_id= param occurrences", () => {
      const html = `
        <html>
          <head></head>
          <body>
            <a href="https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}">Feed</a>
          </body>
        </html>
      `;

      expect(extractYouTubeChannelIdFromHtml(html)).toBe(channelId);
    });

    it("extracts channel id from embedded JSON keys", () => {
      const html = `
        <script>
          var data = {"externalId":"${channelId}","title":"Example"};
        </script>
      `;

      expect(extractYouTubeChannelIdFromHtml(html)).toBe(channelId);
    });

    it("does not extract channel id without a key", () => {
      const html = `<html><body>channel id maybe ${channelId} but no key</body></html>`;
      expect(extractYouTubeChannelIdFromHtml(html)).toBe(null);
    });
  });
});
