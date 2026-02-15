import { describe, expect, it } from "vitest";
import {
  buildChunkFallbackRows,
  buildImportFailureReport,
  isImportFailureRow,
  parseRetryAfterSeconds,
  reconcileChunkRowsByUrl,
} from "@/lib/shared/feed-import-client";
import type {
  FeedImportEntry,
  FeedImportRowResult,
} from "@/lib/shared/feed-import-types";

describe("feed import client helpers", () => {
  it("parses Retry-After seconds and clamps to supported bounds", () => {
    expect(parseRetryAfterSeconds("7")).toBe(7);
    expect(parseRetryAfterSeconds("60")).toBe(30);
    expect(parseRetryAfterSeconds("0")).toBe(1);
    expect(parseRetryAfterSeconds("not-a-number")).toBe(5);
  });

  it("parses Retry-After HTTP date values", () => {
    const now = Date.parse("2026-02-12T00:00:00.000Z");
    const retryAt = new Date(now + 6_000).toUTCString();

    expect(parseRetryAfterSeconds(retryAt, now)).toBe(6);
  });

  it("reconciles chunk rows by URL and fills missing rows with deterministic fallbacks", () => {
    const entries: FeedImportEntry[] = [
      { url: "https://a.example.com/feed.xml", folderNames: [], customTitle: null },
      { url: "https://b.example.com/feed.xml", folderNames: [], customTitle: null },
      { url: "https://c.example.com/feed.xml", folderNames: [], customTitle: null },
    ];

    const reconciled = reconcileChunkRowsByUrl({
      entries,
      rows: [
        { url: "https://b.example.com/feed.xml", status: "imported" },
        { url: "https://unknown.example.com/feed.xml", status: "imported" },
        {
          url: "https://c.example.com/feed.xml",
          status: "duplicate_unchanged",
          code: "duplicate",
        },
        // Duplicate URL should be ignored after first accepted row.
        { url: "https://b.example.com/feed.xml", status: "failed", code: "unknown" },
      ],
      fallbackMessage: "Could not import this chunk.",
    });

    expect(reconciled).toEqual([
      {
        url: "https://a.example.com/feed.xml",
        status: "failed",
        code: "unknown",
        message: "Could not import this chunk.",
      },
      {
        url: "https://b.example.com/feed.xml",
        status: "imported",
      },
      {
        url: "https://c.example.com/feed.xml",
        status: "duplicate_unchanged",
        code: "duplicate",
      },
    ]);
  });

  it("builds fallback chunk rows and classifies failure rows", () => {
    const rows = buildChunkFallbackRows(
      [{ url: "https://a.example.com/feed.xml", folderNames: [], customTitle: null }],
      "Could not connect to the server.",
    );

    expect(rows).toEqual([
      {
        url: "https://a.example.com/feed.xml",
        status: "failed",
        code: "unknown",
        message: "Could not connect to the server.",
      },
    ]);
    expect(isImportFailureRow(rows[0])).toBe(true);
    expect(
      isImportFailureRow({
        url: "https://ok.example.com/feed.xml",
        status: "imported",
      } as FeedImportRowResult),
    ).toBe(false);
  });

  it("builds a plain-text diagnostics report with failed rows and warnings", () => {
    const report = buildImportFailureReport({
      fileName: "feeds.opml",
      generatedAtIso: "2026-02-12T00:00:00.000Z",
      failedRows: [
        {
          url: "https://a.example.com/feed.xml",
          status: "failed",
          code: "invalid_xml",
          message: "No feed was found.",
        },
        {
          url: "https://b.example.com/feed.xml",
          status: "skipped_multiple_candidates",
          code: "multiple_candidates",
          message: "Choose one feed URL manually.",
        },
      ],
      warningRows: [
        {
          url: "https://c.example.com/feed.xml",
          status: "imported",
          warnings: ['Folder "Tech" could not be created.'],
        },
      ],
    });

    expect(report).toContain("FeedMyOwl import diagnostics report");
    expect(report).toContain("Source file: feeds.opml");
    expect(report).toContain("Generated at: 2026-02-12T00:00:00.000Z");
    expect(report).toContain("Failed entries: 2");
    expect(report).toContain("Warning entries: 1");
    expect(report).toContain("Failures:");
    expect(report).toContain("https://a.example.com/feed.xml [invalid_xml]");
    expect(report).toContain(
      "https://b.example.com/feed.xml [multiple_candidates] - Choose one feed URL manually.",
    );
    expect(report).toContain("Warnings:");
    expect(report).toContain(
      'https://c.example.com/feed.xml [warning] - Folder "Tech" could not be created.',
    );
  });
});
