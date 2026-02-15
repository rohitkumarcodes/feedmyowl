export const THEME_MODE_VALUES = ["light", "dark", "system"] as const;

export type ThemeMode = (typeof THEME_MODE_VALUES)[number];
export type ResolvedThemeMode = Exclude<ThemeMode, "system">;

export const DEFAULT_THEME_MODE: ThemeMode = "system";

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

function getSystemThemeMode(): ResolvedThemeMode {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return "light";
  }

  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function resolveThemeMode(mode: ThemeMode): ResolvedThemeMode {
  if (mode === "system") {
    return getSystemThemeMode();
  }

  return mode;
}

/**
 * Apply the selected theme to the top-level document root.
 */
export function applyThemeModeToDocument(mode: ThemeMode): void {
  if (typeof document === "undefined") {
    return;
  }

  document.documentElement.dataset.theme = resolveThemeMode(mode);
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

/**
 * Subscribe to system appearance changes (light/dark).
 */
export function subscribeToSystemThemeModeChanges(
  onChange: (mode: ResolvedThemeMode) => void,
): () => void {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return () => {};
  }

  const mediaQueryList = window.matchMedia("(prefers-color-scheme: dark)");
  const handleChange = () => {
    onChange(mediaQueryList.matches ? "dark" : "light");
  };

  if (typeof mediaQueryList.addEventListener === "function") {
    mediaQueryList.addEventListener("change", handleChange);
    return () => {
      mediaQueryList.removeEventListener("change", handleChange);
    };
  }

  mediaQueryList.addListener(handleChange);
  return () => {
    mediaQueryList.removeListener(handleChange);
  };
}
