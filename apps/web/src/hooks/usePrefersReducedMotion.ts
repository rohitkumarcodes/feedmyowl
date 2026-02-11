"use client";

import { useEffect, useState } from "react";

export function usePrefersReducedMotion(): boolean {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
      return;
    }

    const mediaQueryList = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updatePreference = (event?: MediaQueryListEvent) => {
      setPrefersReducedMotion(event ? event.matches : mediaQueryList.matches);
    };

    updatePreference();

    if (typeof mediaQueryList.addEventListener === "function") {
      mediaQueryList.addEventListener("change", updatePreference);
      return () => {
        mediaQueryList.removeEventListener("change", updatePreference);
      };
    }

    mediaQueryList.addListener(updatePreference);
    return () => {
      mediaQueryList.removeListener(updatePreference);
    };
  }, []);

  return prefersReducedMotion;
}
