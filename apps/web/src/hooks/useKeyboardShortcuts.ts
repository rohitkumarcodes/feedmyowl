/**
 * Registers feed-reader keyboard shortcuts and routes them to callbacks.
 */

import { useEffect } from "react";

interface UseKeyboardShortcutsOptions {
  onNextArticle: () => void;
  onPreviousArticle: () => void;
  onOpenArticle: () => void;
  onRefreshFeeds: () => void;
}

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  const tag = target.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") {
    return true;
  }

  return target.isContentEditable;
}

/**
 * Attaches document-level key handlers for navigation and refresh.
 */
export function useKeyboardShortcuts({
  onNextArticle,
  onPreviousArticle,
  onOpenArticle,
  onRefreshFeeds,
}: UseKeyboardShortcutsOptions) {
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (isTypingTarget(event.target)) {
        return;
      }

      const key = event.key;

      if ((key === "j" || key === "ArrowDown") && !event.metaKey && !event.ctrlKey) {
        event.preventDefault();
        onNextArticle();
        return;
      }

      if ((key === "k" || key === "ArrowUp") && !event.metaKey && !event.ctrlKey) {
        event.preventDefault();
        onPreviousArticle();
        return;
      }

      if (key === "Enter" && !event.metaKey && !event.ctrlKey) {
        event.preventDefault();
        onOpenArticle();
        return;
      }

      if (key.toLowerCase() === "r" && !event.metaKey && !event.ctrlKey && !event.altKey) {
        event.preventDefault();
        onRefreshFeeds();
      }
    }

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [onNextArticle, onOpenArticle, onPreviousArticle, onRefreshFeeds]);
}
