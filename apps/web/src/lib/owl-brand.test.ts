import { describe, expect, it } from "vitest";
import {
  DEFAULT_OWL_ASCII,
  OWL_ART_OPTIONS,
  buildOwlFaviconDataUri,
  coerceOwlAscii,
  isOwlAscii,
} from "@/lib/owl-brand";

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

  it("escapes and encodes XML-sensitive characters for favicon data URIs", () => {
    const favicon = buildOwlFaviconDataUri("</o,o>");

    expect(favicon.startsWith("data:image/svg+xml,")).toBe(true);

    const encodedSvg = favicon.slice("data:image/svg+xml,".length);
    const decodedSvg = decodeURIComponent(encodedSvg);

    expect(decodedSvg).toContain("&lt;/o,o&gt;");
    expect(decodedSvg).not.toContain("</o,o>");

    const curlyFavicon = buildOwlFaviconDataUri("{o,o}");
    const curlySvg = decodeURIComponent(
      curlyFavicon.slice("data:image/svg+xml,".length)
    );
    expect(curlySvg).toContain("{o,o}");
  });
});
