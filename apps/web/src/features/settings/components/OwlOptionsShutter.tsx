"use client";

import { useEffect, useRef, useState, type ReactNode, type TransitionEvent } from "react";
import styles from "./SettingsOverview.module.css";

export interface OwlOptionsShutterProps {
  expanded: boolean;
  prefersReducedMotion: boolean;
  contentId: string;
  children: ReactNode;
}

export function OwlOptionsShutter({
  expanded,
  prefersReducedMotion,
  contentId,
  children,
}: OwlOptionsShutterProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const animationFrameRef = useRef<number | null>(null);
  const [isRendered, setIsRendered] = useState(expanded);
  const [heightPx, setHeightPx] = useState<string>(expanded ? "auto" : "0px");

  useEffect(() => {
    return () => {
      if (animationFrameRef.current !== null) {
        window.cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (animationFrameRef.current !== null) {
      window.cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    if (prefersReducedMotion) {
      if (expanded) {
        setIsRendered(true);
        setHeightPx("auto");
      } else {
        setHeightPx("0px");
        setIsRendered(false);
      }
      return;
    }

    if (expanded && !isRendered) {
      setIsRendered(true);
      setHeightPx("0px");
      return;
    }

    if (!isRendered) {
      return;
    }

    const container = containerRef.current;
    const content = contentRef.current;
    if (!container || !content) {
      return;
    }

    const startHeight = container.getBoundingClientRect().height;
    const endHeight = expanded ? content.scrollHeight : 0;

    if (expanded && startHeight === endHeight) {
      setHeightPx("auto");
      return;
    }

    if (!expanded && startHeight === 0) {
      setHeightPx("0px");
      setIsRendered(false);
      return;
    }

    setHeightPx(`${startHeight}px`);
    animationFrameRef.current = window.requestAnimationFrame(() => {
      setHeightPx(`${endHeight}px`);
      animationFrameRef.current = null;
    });
  }, [expanded, isRendered, prefersReducedMotion]);

  const handleTransitionEnd = (event: TransitionEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget || event.propertyName !== "height") {
      return;
    }

    if (expanded) {
      setHeightPx("auto");
      return;
    }

    setHeightPx("0px");
    setIsRendered(false);
  };

  const isFullyExpanded = expanded && isRendered && heightPx === "auto";

  return (
    <div
      id={contentId}
      ref={containerRef}
      className={styles.owlOptionsShutter}
      style={{
        height: isRendered ? heightPx : "0px",
        overflow: isFullyExpanded ? "visible" : "hidden",
      }}
      onTransitionEnd={handleTransitionEnd}
      aria-hidden={!expanded}
    >
      {isRendered ? (
        <div ref={contentRef} className={styles.owlOptionsShutterContent}>
          {children}
        </div>
      ) : null}
    </div>
  );
}
