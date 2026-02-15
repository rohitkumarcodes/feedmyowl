import { describe, expect, it } from "vitest";
import {
  ARTICLE_ALLOWED_URI_REGEXP,
  ARTICLE_SANITIZE_CONFIG,
} from "@/lib/shared/article-sanitize-config";

describe("ARTICLE_SANITIZE_CONFIG", () => {
  it("blocks javascript and data URI schemes", () => {
    expect(ARTICLE_ALLOWED_URI_REGEXP.test("javascript:alert(1)")).toBe(false);
    expect(ARTICLE_ALLOWED_URI_REGEXP.test("data:text/html;base64,SGk=")).toBe(false);
  });

  it("allows safe http/https/mailto URIs", () => {
    expect(ARTICLE_ALLOWED_URI_REGEXP.test("https://example.com")).toBe(true);
    expect(ARTICLE_ALLOWED_URI_REGEXP.test("http://example.com")).toBe(true);
    expect(ARTICLE_ALLOWED_URI_REGEXP.test("mailto:test@example.com")).toBe(true);
  });

  it("explicitly forbids script/style and inline style/event attributes", () => {
    expect(ARTICLE_SANITIZE_CONFIG.FORBID_TAGS).toContain("script");
    expect(ARTICLE_SANITIZE_CONFIG.FORBID_TAGS).toContain("style");
    expect(ARTICLE_SANITIZE_CONFIG.FORBID_ATTR).toContain("style");
    expect(ARTICLE_SANITIZE_CONFIG.FORBID_ATTR).toContain("onerror");
  });
});
