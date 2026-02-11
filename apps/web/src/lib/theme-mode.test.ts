import { describe, expect, it } from "vitest";
import {
  DEFAULT_THEME_MODE,
  coerceThemeMode,
  isThemeMode,
  resolveThemeMode,
  THEME_MODE_VALUES,
} from "@/lib/theme-mode";

describe("theme-mode helpers", () => {
  it("accepts valid theme values", () => {
    for (const mode of THEME_MODE_VALUES) {
      expect(isThemeMode(mode)).toBe(true);
      expect(coerceThemeMode(mode)).toBe(mode);
    }
  });

  it("rejects invalid values", () => {
    expect(isThemeMode("auto")).toBe(false);
    expect(isThemeMode("DARK")).toBe(false);
  });

  it("falls back to default for unknown input", () => {
    expect(coerceThemeMode(undefined)).toBe(DEFAULT_THEME_MODE);
    expect(coerceThemeMode("auto")).toBe(DEFAULT_THEME_MODE);
    expect(coerceThemeMode(123)).toBe(DEFAULT_THEME_MODE);
  });

  it("resolves system mode to light in non-browser environments", () => {
    expect(resolveThemeMode("system")).toBe("light");
  });
});
