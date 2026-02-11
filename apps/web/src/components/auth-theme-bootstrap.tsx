"use client";

import { useLayoutEffect } from "react";
import {
  applyThemeModeToDocument,
  clearThemeModeFromDocument,
  type ThemeMode,
} from "@/lib/theme-mode";

interface AuthThemeBootstrapProps {
  initialThemeMode: ThemeMode;
}

/**
 * Applies authenticated theme mode to <html> while auth routes are mounted.
 */
export function AuthThemeBootstrap({ initialThemeMode }: AuthThemeBootstrapProps) {
  useLayoutEffect(() => {
    applyThemeModeToDocument(initialThemeMode);

    return () => {
      clearThemeModeFromDocument();
    };
  }, [initialThemeMode]);

  return null;
}
