/**
 * Detects left-edge swipe-right gestures on mobile to navigate back in the view stack.
 *
 * Fires the appropriate back callback when the user swipes from the left edge
 * (start X < 30px) with enough horizontal distance (> 80px) and a shallow angle.
 */

import { useEffect, useRef, type RefObject } from "react";

interface UseSwipeBackOptions {
  /** Ref to the container element to listen for touch events. */
  containerRef: RefObject<HTMLElement | null>;
  /** Current mobile view — no swipe-back from "feeds" (root). */
  mobileView: "feeds" | "articles" | "reader";
  onMobileBackToFeeds: () => void;
  onMobileBackToArticles: () => void;
}

/** Maximum starting X coordinate (px from left edge) to activate swipe detection. */
const EDGE_THRESHOLD = 30;

/** Minimum horizontal distance (px) to trigger the back navigation. */
const MIN_SWIPE_DISTANCE = 80;

/** Maximum angle (degrees) from horizontal to count as a valid swipe. */
const MAX_ANGLE_DEG = 30;

export function useSwipeBack({
  containerRef,
  mobileView,
  onMobileBackToFeeds,
  onMobileBackToArticles,
}: UseSwipeBackOptions) {
  const startRef = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    function handleTouchStart(event: TouchEvent) {
      const touch = event.touches[0];
      if (!touch || touch.clientX > EDGE_THRESHOLD) {
        startRef.current = null;
        return;
      }

      startRef.current = { x: touch.clientX, y: touch.clientY };
    }

    function handleTouchEnd(event: TouchEvent) {
      const start = startRef.current;
      startRef.current = null;

      if (!start) {
        return;
      }

      const touch = event.changedTouches[0];
      if (!touch) {
        return;
      }

      const deltaX = touch.clientX - start.x;
      const deltaY = touch.clientY - start.y;

      /* Must swipe rightward. */
      if (deltaX < MIN_SWIPE_DISTANCE) {
        return;
      }

      /* Check angle — must be mostly horizontal. */
      const angleDeg = Math.abs(Math.atan2(deltaY, deltaX) * (180 / Math.PI));
      if (angleDeg > MAX_ANGLE_DEG) {
        return;
      }

      if (mobileView === "reader") {
        onMobileBackToArticles();
      } else if (mobileView === "articles") {
        onMobileBackToFeeds();
      }
    }

    container.addEventListener("touchstart", handleTouchStart, { passive: true });
    container.addEventListener("touchend", handleTouchEnd, { passive: true });

    return () => {
      container.removeEventListener("touchstart", handleTouchStart);
      container.removeEventListener("touchend", handleTouchEnd);
    };
  }, [containerRef, mobileView, onMobileBackToFeeds, onMobileBackToArticles]);
}
