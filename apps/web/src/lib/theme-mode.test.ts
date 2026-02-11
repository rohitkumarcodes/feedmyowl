import { describe, expect, it } from "vitest";
import {
  DEFAULT_THEME_MODE,
  coerceThemeMode,
  isThemeMode,
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
    expect(isThemeMode("system")).toBe(false);
    expect(isThemeMode("DARK")).toBe(false);
  });

  it("falls back to default for unknown input", () => {
    expect(coerceThemeMode(undefined)).toBe(DEFAULT_THEME_MODE);
    expect(coerceThemeMode("system")).toBe(DEFAULT_THEME_MODE);
    expect(coerceThemeMode(123)).toBe(DEFAULT_THEME_MODE);
  });
});
