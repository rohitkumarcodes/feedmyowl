import { describe, expect, it } from "vitest";
import { normalizeFeedUrl } from "@/lib/feed-url";

describe("normalizeFeedUrl", () => {
  it("keeps explicit http/https URLs", () => {
    expect(normalizeFeedUrl("https://example.com/feed.xml")).toBe(
      "https://example.com/feed.xml"
    );
    expect(normalizeFeedUrl("http://example.com")).toBe("http://example.com/");
  });

  it("prepends https when scheme is missing", () => {
    expect(normalizeFeedUrl("example.com")).toBe("https://example.com/");
    expect(normalizeFeedUrl("www.example.com/rss.xml")).toBe(
      "https://www.example.com/rss.xml"
    );
  });

  it("rejects invalid or unsupported URLs", () => {
    expect(normalizeFeedUrl("")).toBeNull();
    expect(normalizeFeedUrl("   ")).toBeNull();
    expect(normalizeFeedUrl("ftp://example.com/feed.xml")).toBeNull();
    expect(normalizeFeedUrl("https://")).toBeNull();
    expect(normalizeFeedUrl(null)).toBeNull();
  });
});
