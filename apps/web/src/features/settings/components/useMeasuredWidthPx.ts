"use client";

import { useLayoutEffect, useState, type RefObject } from "react";

export function useMeasuredWidthPx<T extends HTMLElement>(
  probeRef: RefObject<T | null>,
): number | null {
  const [widthPx, setWidthPx] = useState<number | null>(null);

  useLayoutEffect(() => {
    const probe = probeRef.current;
    if (!probe) {
      return;
    }

    const measure = () => {
      const measuredWidth = Math.ceil(probe.getBoundingClientRect().width);
      if (measuredWidth <= 0) {
        return;
      }

      setWidthPx((previousWidth) =>
        previousWidth === measuredWidth ? previousWidth : measuredWidth,
      );
    };

    measure();
    const animationFrame = window.requestAnimationFrame(measure);

    const resizeObserver =
      typeof ResizeObserver === "function"
        ? new ResizeObserver(() => {
            measure();
          })
        : null;

    resizeObserver?.observe(probe);

    return () => {
      window.cancelAnimationFrame(animationFrame);
      resizeObserver?.disconnect();
    };
  }, [probeRef]);

  return widthPx;
}
