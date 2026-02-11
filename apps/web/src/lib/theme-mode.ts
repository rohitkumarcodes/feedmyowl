export const THEME_MODE_VALUES = ["light", "dark"] as const;

export type ThemeMode = (typeof THEME_MODE_VALUES)[number];

export const DEFAULT_THEME_MODE: ThemeMode = "light";

const themeModeSet = new Set<string>(THEME_MODE_VALUES);

export function isThemeMode(value: string): value is ThemeMode {
  return themeModeSet.has(value);
}

export function coerceThemeMode(value: unknown): ThemeMode {
  if (typeof value === "string" && isThemeMode(value)) {
    return value;
  }

  return DEFAULT_THEME_MODE;
}

/**
 * Apply the selected theme to the top-level document root.
 */
export function applyThemeModeToDocument(mode: ThemeMode): void {
  if (typeof document === "undefined") {
    return;
  }

  document.documentElement.dataset.theme = mode;
}

/**
 * Remove explicit theme override from the top-level document root.
 */
export function clearThemeModeFromDocument(): void {
  if (typeof document === "undefined") {
    return;
  }

  delete document.documentElement.dataset.theme;
}
