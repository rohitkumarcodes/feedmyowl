"use client";

import { useCallback, useEffect, useState } from "react";

export type FeedsWorkspaceMobileView = "feeds" | "articles" | "reader";

/**
 * Mobile viewport and history-driven stacked view management.
 */
export function useFeedsWorkspaceMobile() {
  const [isMobile, setIsMobile] = useState(false);
  const [mobileView, setMobileView] = useState<FeedsWorkspaceMobileView>("feeds");

  useEffect(() => {
    const mediaQuery = window.matchMedia("(max-width: 767px)");

    const applyMobileState = () => {
      setIsMobile(mediaQuery.matches);
      if (!mediaQuery.matches) {
        setMobileView("feeds");
      }
    };

    applyMobileState();
    mediaQuery.addEventListener("change", applyMobileState);

    return () => {
      mediaQuery.removeEventListener("change", applyMobileState);
    };
  }, []);

  useEffect(() => {
    if (!isMobile) {
      return;
    }

    const currentState = window.history.state || {};
    if (!currentState.feedmyowlView) {
      window.history.replaceState({ ...currentState, feedmyowlView: "feeds" }, "");
    }

    const onPopState = (event: PopStateEvent) => {
      const nextView = event.state?.feedmyowlView;
      if (nextView === "feeds" || nextView === "articles" || nextView === "reader") {
        setMobileView(nextView);
      }
    };

    window.addEventListener("popstate", onPopState);
    return () => {
      window.removeEventListener("popstate", onPopState);
    };
  }, [isMobile]);

  const setMobileViewWithHistory = useCallback(
    (nextView: FeedsWorkspaceMobileView, shouldPush = true) => {
      if (!isMobile) {
        return;
      }

      setMobileView(nextView);

      const currentState = window.history.state || {};
      if (shouldPush) {
        window.history.pushState({ ...currentState, feedmyowlView: nextView }, "");
        return;
      }

      window.history.replaceState({ ...currentState, feedmyowlView: nextView }, "");
    },
    [isMobile],
  );

  const onMobileBackToFeeds = useCallback(() => {
    setMobileViewWithHistory("feeds", false);
  }, [setMobileViewWithHistory]);

  const onMobileBackToArticles = useCallback(() => {
    setMobileViewWithHistory("articles", false);
  }, [setMobileViewWithHistory]);

  return {
    isMobile,
    mobileView,
    setMobileViewWithHistory,
    onMobileBackToFeeds,
    onMobileBackToArticles,
  };
}
