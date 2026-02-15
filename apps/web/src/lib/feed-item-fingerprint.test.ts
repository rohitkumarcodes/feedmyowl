import { describe, expect, it } from "vitest";
import { computeFeedItemFingerprint } from "@/lib/server/feed-item-fingerprint";

describe("computeFeedItemFingerprint", () => {
  it("returns deterministic hash for semantically equivalent content", () => {
    const first = computeFeedItemFingerprint({
      link: "https://example.com/article",
      title: "Hello World",
      content: "<p>  Hello   world </p>",
      author: "Alice",
      publishedAt: new Date("2026-02-11T00:00:00.000Z"),
    });

    const second = computeFeedItemFingerprint({
      link: "https://example.com/article ",
      title: "  hello world",
      content: "Hello world",
      author: "alice",
      publishedAt: new Date("2026-02-11T00:00:00.000Z"),
    });

    expect(first).toBe(second);
  });

  it("changes hash when core identity fields change", () => {
    const base = computeFeedItemFingerprint({
      link: "https://example.com/article",
      title: "Hello World",
      content: "Body",
      author: "Alice",
      publishedAt: new Date("2026-02-11T00:00:00.000Z"),
    });

    const changedLink = computeFeedItemFingerprint({
      link: "https://example.com/article-2",
      title: "Hello World",
      content: "Body",
      author: "Alice",
      publishedAt: new Date("2026-02-11T00:00:00.000Z"),
    });

    expect(changedLink).not.toBe(base);
  });
});
