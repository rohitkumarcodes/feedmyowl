"use client";

import { useLayoutEffect } from "react";
import {
  applyThemeModeToDocument,
  clearThemeModeFromDocument,
  subscribeToSystemThemeModeChanges,
  type ThemeMode,
} from "@/lib/shared/theme-mode";

interface AuthThemeBootstrapProps {
  initialThemeMode: ThemeMode;
}

/**
 * Applies authenticated theme mode to <html> while auth routes are mounted.
 */
export function AuthThemeBootstrap({ initialThemeMode }: AuthThemeBootstrapProps) {
  useLayoutEffect(() => {
    applyThemeModeToDocument(initialThemeMode);
    const stopSystemSync =
      initialThemeMode === "system"
        ? subscribeToSystemThemeModeChanges(() => {
            applyThemeModeToDocument("system");
          })
        : null;

    return () => {
      stopSystemSync?.();
      clearThemeModeFromDocument();
    };
  }, [initialThemeMode]);

  return null;
}
