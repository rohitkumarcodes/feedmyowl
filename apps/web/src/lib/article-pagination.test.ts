import { describe, expect, it } from "vitest";
import {
  decodeArticleCursor,
  encodeArticleCursor,
  parseArticlePageLimit,
  parseScopeFromSearchParams,
  scopeToKey,
} from "@/lib/shared/article-pagination";

describe("article-pagination", () => {
  it("encodes and decodes a cursor payload", () => {
    const encoded = encodeArticleCursor({
      v: 1,
      sortKeyIso: "2026-02-11T13:00:00.000Z",
      itemId: "item_123",
    });

    const decoded = decodeArticleCursor(encoded);
    expect(decoded).toEqual({
      ok: true,
      value: {
        v: 1,
        sortKeyIso: "2026-02-11T13:00:00.000Z",
        itemId: "item_123",
      },
    });
  });

  it("rejects malformed cursor payloads and version mismatch", () => {
    const badBase64 = decodeArticleCursor("%%%");
    expect(badBase64.ok).toBe(false);

    const wrongVersion = decodeArticleCursor(
      Buffer.from(
        JSON.stringify({
          v: 2,
          sortKeyIso: "2026-02-11T13:00:00.000Z",
          itemId: "item_123",
        }),
        "utf8",
      ).toString("base64url"),
    );
    expect(wrongVersion.ok).toBe(false);
  });

  it("parses scope and generates stable scope keys", () => {
    const allScope = parseScopeFromSearchParams(new URLSearchParams("scopeType=all"));
    expect(allScope).toEqual({
      ok: true,
      value: { type: "all" },
    });
    if (!allScope.ok) {
      throw new Error("Expected all scope to parse.");
    }
    expect(scopeToKey(allScope.value)).toBe("all");

    const folderScope = parseScopeFromSearchParams(
      new URLSearchParams("scopeType=folder&scopeId=folder-1"),
    );
    expect(folderScope).toEqual({
      ok: true,
      value: { type: "folder", id: "folder-1" },
    });
    if (!folderScope.ok) {
      throw new Error("Expected folder scope to parse.");
    }
    expect(scopeToKey(folderScope.value)).toBe("folder:folder-1");
  });

  it("rejects missing scope ids and invalid scope types", () => {
    const missingScopeId = parseScopeFromSearchParams(
      new URLSearchParams("scopeType=folder"),
    );
    expect(missingScopeId.ok).toBe(false);

    const invalidScopeType = parseScopeFromSearchParams(
      new URLSearchParams("scopeType=broken"),
    );
    expect(invalidScopeType.ok).toBe(false);
  });

  it("parses page limit defaults and clamps max while rejecting invalid values", () => {
    expect(parseArticlePageLimit(null)).toEqual({ ok: true, value: 40 });
    expect(parseArticlePageLimit("12")).toEqual({ ok: true, value: 12 });
    expect(parseArticlePageLimit("999")).toEqual({ ok: true, value: 80 });
    expect(parseArticlePageLimit("0").ok).toBe(false);
    expect(parseArticlePageLimit("abc").ok).toBe(false);
  });
});
