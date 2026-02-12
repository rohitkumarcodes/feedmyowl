import { describe, expect, it } from "vitest";
import {
  dedupeBulkFeedLines,
  parseBulkFeedLines,
  summarizeBulkAddRows,
} from "@/lib/add-feed-bulk";

describe("add-feed bulk helpers", () => {
  it("parses trimmed non-empty lines from textarea input", () => {
    expect(
      parseBulkFeedLines(`
        https://a.example/feed.xml

        https://b.example/rss.xml
      `)
    ).toEqual(["https://a.example/feed.xml", "https://b.example/rss.xml"]);
  });

  it("dedupes lines while preserving order", () => {
    expect(
      dedupeBulkFeedLines([
        "https://a.example/feed.xml",
        "https://b.example/feed.xml",
        "https://a.example/feed.xml",
      ])
    ).toEqual(["https://a.example/feed.xml", "https://b.example/feed.xml"]);
  });

  it("aggregates row results into counts and failure details", () => {
    const summary = summarizeBulkAddRows([
      { url: "https://a.example/feed.xml", status: "imported" },
      {
        url: "https://b.example/feed.xml",
        status: "merged",
        message: "This feed is already in your library. Added to 1 folder.",
      },
      { url: "https://e.example/feed.xml", status: "duplicate" },
      {
        url: "https://c.example/feed.xml",
        status: "failed",
        message: "Multiple feeds found; add this URL individually to choose one.",
      },
      { url: "https://d.example/feed.xml", status: "failed" },
    ]);

    expect(summary).toEqual({
      processedCount: 5,
      importedCount: 1,
      mergedCount: 1,
      duplicateUnchangedCount: 1,
      failedCount: 2,
      failedDetails: [
        "https://c.example/feed.xml — Multiple feeds found; add this URL individually to choose one.",
        "https://d.example/feed.xml — Could not import.",
      ],
    });
  });
});
