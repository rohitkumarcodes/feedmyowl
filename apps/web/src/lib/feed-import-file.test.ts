import { describe, expect, it } from "vitest";
import {
  chunkImportEntries,
  normalizeAndMergeImportEntries,
  parseImportFileContents,
  parseJsonImportEntries,
  parseOpmlImportEntries,
  summarizeImportRows,
} from "@/lib/shared/feed-import-file";
import type { FeedImportRowResult } from "@/lib/shared/feed-import-types";

describe("feed import file helpers", () => {
  it("parses OPML entries with flattened nested folder paths", () => {
    const opml = `<?xml version="1.0" encoding="UTF-8"?>
<opml version="2.0">
  <body>
    <outline text="Tech">
      <outline text="Web">
        <outline text="Web Feed" xmlUrl="https://example.com/web.xml" />
      </outline>
      <outline text="Dev Feed" xmlUrl="https://example.com/dev.xml" />
    </outline>
    <outline text="Uncategorized Feed" xmlUrl="https://example.com/main.xml" />
  </body>
</opml>`;

    const entries = parseOpmlImportEntries(opml);

    expect(entries).toEqual([
      {
        url: "https://example.com/web.xml",
        folderNames: ["Tech / Web"],
        customTitle: "Web Feed",
      },
      {
        url: "https://example.com/dev.xml",
        folderNames: ["Tech"],
        customTitle: "Dev Feed",
      },
      {
        url: "https://example.com/main.xml",
        folderNames: [],
        customTitle: "Uncategorized Feed",
      },
    ]);
  });

  it("parses OPML category-only folder assignments", () => {
    const opml = `<?xml version="1.0" encoding="UTF-8"?>
<opml version="2.0">
  <body>
    <outline
      text="Category Feed"
      xmlUrl="https://example.com/category.xml"
      category="/Tech/Web, /News, /Tech/Web/"
    />
  </body>
</opml>`;

    const entries = parseOpmlImportEntries(opml);

    expect(entries).toEqual([
      {
        url: "https://example.com/category.xml",
        folderNames: ["Tech / Web", "News"],
        customTitle: "Category Feed",
      },
    ]);
  });

  it("preserves parent folder context for non-self-closing feed outlines", () => {
    const opml = `<?xml version="1.0" encoding="UTF-8"?>
<opml version="2.0">
  <body>
    <outline text="Tech">
      <outline text="First Feed" xmlUrl="https://example.com/first.xml"></outline>
      <outline text="Second Feed" xmlUrl="https://example.com/second.xml"></outline>
    </outline>
  </body>
</opml>`;

    const entries = parseOpmlImportEntries(opml);

    expect(entries).toEqual([
      {
        url: "https://example.com/first.xml",
        folderNames: ["Tech"],
        customTitle: "First Feed",
      },
      {
        url: "https://example.com/second.xml",
        folderNames: ["Tech"],
        customTitle: "Second Feed",
      },
    ]);
  });

  it("merges nested and category folder assignments without duplicates", () => {
    const opml = `<?xml version="1.0" encoding="UTF-8"?>
<opml version="2.0">
  <body>
    <outline text="Tech">
      <outline
        text="Web Feed"
        xmlUrl="https://example.com/web.xml"
        category="/Tech/Web, /Productivity"
      />
    </outline>
  </body>
</opml>`;

    const entries = parseOpmlImportEntries(opml);

    expect(entries).toEqual([
      {
        url: "https://example.com/web.xml",
        folderNames: ["Tech", "Tech / Web", "Productivity"],
        customTitle: "Web Feed",
      },
    ]);
  });

  it("parses portable JSON v2 exports", () => {
    const portable = parseJsonImportEntries(
      JSON.stringify({
        version: 2,
        sourceApp: "FeedMyOwl",
        exportedAt: "2026-02-11T00:00:00.000Z",
        feeds: [
          {
            url: "https://example.com/c.xml",
            customTitle: "Custom C",
            folders: ["Folder C", "Folder D"],
          },
        ],
      }),
    );

    expect(portable).toEqual([
      {
        url: "https://example.com/c.xml",
        folderNames: ["Folder C", "Folder D"],
        customTitle: "Custom C",
      },
    ]);
  });

  it("rejects legacy JSON export shapes", () => {
    expect(() =>
      parseJsonImportEntries(
        JSON.stringify({
          exportedAt: "2026-02-11T00:00:00.000Z",
          folders: [{ id: "folder_a", name: "Folder A" }],
          feeds: [
            {
              url: "https://example.com/a.xml",
              folderIds: ["folder_a"],
            },
          ],
        }),
      ),
    ).toThrow(
      "Only FeedMyOwl portable JSON v2 exports are supported. Found version unknown. Re-export your feeds as JSON v2 and try again.",
    );
  });

  it("normalizes URLs and merges duplicate entries", () => {
    const merged = normalizeAndMergeImportEntries([
      {
        url: "example.com/feed.xml",
        folderNames: ["Tech"],
        customTitle: null,
      },
      {
        url: "https://example.com/feed.xml",
        folderNames: ["Web"],
        customTitle: "Example Feed",
      },
      {
        url: "invalid://feed",
        folderNames: ["Ignored"],
        customTitle: "Ignored",
      },
    ]);

    expect(merged).toEqual([
      {
        url: "https://example.com/feed.xml",
        folderNames: ["Tech", "Web"],
        customTitle: "Example Feed",
      },
    ]);
  });

  it("splits entries into deterministic chunks for high-volume imports", () => {
    const entries = Array.from({ length: 500 }, (_, index) => ({
      url: `https://example.com/${index}.xml`,
      folderNames: [],
      customTitle: null,
    }));

    const chunks = chunkImportEntries(entries, 20);

    expect(chunks).toHaveLength(25);
    expect(chunks[0]).toHaveLength(20);
    expect(chunks[chunks.length - 1]).toHaveLength(20);
    expect(chunks.flat()).toHaveLength(500);
  });

  it("summarizes import rows with merged duplicates and failure details", () => {
    const rows: FeedImportRowResult[] = [
      {
        url: "https://a.example/feed.xml",
        status: "imported",
        warnings: ['Folder "Tech" could not be created.'],
      },
      {
        url: "https://b.example/feed.xml",
        status: "duplicate_merged",
        code: "duplicate",
        warnings: ['Folder "News" could not be created.'],
      },
      {
        url: "https://c.example/feed.xml",
        status: "duplicate_unchanged",
        code: "duplicate",
      },
      {
        url: "https://d.example/feed.xml",
        status: "skipped_multiple_candidates",
        message: "Choose one feed URL manually.",
        code: "multiple_candidates",
      },
      {
        url: "https://e.example/feed.xml",
        status: "failed",
        message: "Could not import.",
        code: "invalid_xml",
      },
    ];

    expect(summarizeImportRows(rows)).toEqual({
      processedCount: 5,
      importedCount: 1,
      duplicateCount: 2,
      mergedCount: 1,
      failedCount: 2,
      skippedMultipleCount: 1,
      warningCount: 2,
      failedDetails: [
        "https://d.example/feed.xml — Choose one feed URL manually.",
        "https://e.example/feed.xml — Could not import.",
      ],
      warningDetails: [
        'https://a.example/feed.xml — Folder "Tech" could not be created.',
        'https://b.example/feed.xml — Folder "News" could not be created.',
      ],
    });
  });

  it("strips UTF-8 BOM before parsing", () => {
    const bomPrefix = "\uFEFF";
    const jsonContent = JSON.stringify({
      version: 2,
      sourceApp: "FeedMyOwl",
      exportedAt: "2026-02-11T00:00:00.000Z",
      feeds: [{ url: "https://example.com/bom.xml", folders: ["Bom"] }],
    });

    const parsed = parseImportFileContents("feeds.json", bomPrefix + jsonContent);

    expect(parsed.sourceType).toBe("JSON");
    expect(parsed.entries).toHaveLength(1);
    expect(parsed.entries[0].url).toBe("https://example.com/bom.xml");
  });

  it("strips CDATA sections before parsing OPML outline tags", () => {
    const opml = `<?xml version="1.0" encoding="UTF-8"?>
<opml version="2.0">
  <body>
    <outline text="Notes"><![CDATA[<outline text="Fake" xmlUrl="https://fake.test/cdata.xml" />]]></outline>
    <outline text="Real Feed" xmlUrl="https://real.test/feed.xml" />
  </body>
</opml>`;

    const entries = parseOpmlImportEntries(opml);

    expect(entries).toHaveLength(1);
    expect(entries[0].url).toBe("https://real.test/feed.xml");
  });

  it("parses files by extension and rejects unsupported types", () => {
    const parsed = parseImportFileContents(
      "feeds.json",
      JSON.stringify({
        version: 2,
        sourceApp: "FeedMyOwl",
        exportedAt: "2026-02-11T00:00:00.000Z",
        feeds: [{ url: "https://example.com/feed.xml", folders: [] }],
      }),
    );

    expect(parsed.sourceType).toBe("JSON");
    expect(parsed.entries).toHaveLength(1);

    expect(() => parseImportFileContents("feeds.txt", "invalid")).toThrow(
      "Unsupported file type. Use .opml, .xml, or .json.",
    );
  });
});
