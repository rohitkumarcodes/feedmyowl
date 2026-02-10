import { describe, expect, it } from "vitest";
import {
  DEFAULT_OWL_ASCII,
  OWL_ART_OPTIONS,
  OWL_ASCII_VALUES,
  buildOwlFaviconDataUri,
  coerceOwlAscii,
  isOwlAscii,
} from "@/lib/owl-brand";

function extractFaviconText(dataUri: string): string {
  const encodedSvg = dataUri.slice("data:image/svg+xml,".length);
  const decodedSvg = decodeURIComponent(encodedSvg);
  const match = decodedSvg.match(/<text[^>]*>([^<]*)<\/text>/);
  return match?.[1] ?? "";
}

describe("owl-brand helpers", () => {
  it("uses {o,o} as the default owl", () => {
    expect(DEFAULT_OWL_ASCII).toBe("{o,o}");
  });

  it("accepts all configured owl ASCII options", () => {
    for (const option of OWL_ART_OPTIONS) {
      expect(isOwlAscii(option.ascii)).toBe(true);
      expect(coerceOwlAscii(option.ascii)).toBe(option.ascii);
    }
  });

  it("rejects unsupported owl strings and falls back to default", () => {
    expect(isOwlAscii("invalid-owl")).toBe(false);
    expect(isOwlAscii("{o,0}")).toBe(false);
    expect(coerceOwlAscii("invalid-owl")).toBe(DEFAULT_OWL_ASCII);
    expect(coerceOwlAscii(null)).toBe(DEFAULT_OWL_ASCII);
  });

  it("stores Jane copy without quotes and marks it for emphasis", () => {
    const janeOption = OWL_ART_OPTIONS.find((option) => option.ascii === "{o,o}");

    expect(janeOption).toBeDefined();
    expect(janeOption?.description).toBe("Pride and Prejudice and RSS.");
    expect(janeOption?.emphasizeDescription).toBe(true);
  });

  it("maps full owl ASCII variants to compact favicon face glyphs", () => {
    const expectedFaceByAscii: Record<(typeof OWL_ASCII_VALUES)[number], string> = {
      "[o-o]": "o-o",
      "{O,O}": "O,O",
      "{o,o}": "o,o",
      "{o,q}": "o,q",
      "</o,o>": "o,o",
    };

    for (const owlAscii of OWL_ASCII_VALUES) {
      const favicon = buildOwlFaviconDataUri(owlAscii);
      expect(favicon.startsWith("data:image/svg+xml,")).toBe(true);
      expect(extractFaviconText(favicon)).toBe(expectedFaceByAscii[owlAscii]);
    }
  });

  it("returns encoded SVG content suitable for tab icons", () => {
    const favicon = buildOwlFaviconDataUri("</o,o>");
    const encodedSvg = favicon.slice("data:image/svg+xml,".length);
    const decodedSvg = decodeURIComponent(encodedSvg);

    expect(encodedSvg).toContain("%3Csvg");
    expect(decodedSvg).toContain("font-size='132'");
    expect(decodedSvg).toContain("font-weight='700'");
    expect(extractFaviconText(favicon)).toBe("o,o");

    const curlyFavicon = buildOwlFaviconDataUri("{o,o}");
    expect(extractFaviconText(curlyFavicon)).toBe("o,o");
  });
});
