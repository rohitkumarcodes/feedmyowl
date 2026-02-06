/**
 * Registers feed-reader keyboard shortcuts and routes them to callbacks.
 */

import { useEffect } from "react";

interface UseKeyboardShortcutsOptions {
  onNextArticle: () => void;
  onPreviousArticle: () => void;
  onOpenArticle: () => void;
  onRefreshFeeds: () => void;
  onFocusSearch: () => void;
  onClearSearch: () => void;
  onToggleSidebar: () => void;
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
 * Attaches document-level key handlers for navigation, search, and refresh.
 */
export function useKeyboardShortcuts({
  onNextArticle,
  onPreviousArticle,
  onOpenArticle,
  onRefreshFeeds,
  onFocusSearch,
  onClearSearch,
  onToggleSidebar,
}: UseKeyboardShortcutsOptions) {
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      const typing = isTypingTarget(event.target);
      const key = event.key;

      if (key === "Escape") {
        onClearSearch();

        if (event.target instanceof HTMLElement) {
          event.target.blur();
        }
        return;
      }

      if (typing) {
        return;
      }

      if (key === "/" && !event.metaKey && !event.ctrlKey && !event.altKey) {
        event.preventDefault();
        onFocusSearch();
        return;
      }

      if ((event.metaKey || event.ctrlKey) && event.shiftKey && key.toLowerCase() === "s") {
        event.preventDefault();
        onToggleSidebar();
        return;
      }

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
  }, [
    onClearSearch,
    onFocusSearch,
    onNextArticle,
    onOpenArticle,
    onPreviousArticle,
    onRefreshFeeds,
    onToggleSidebar,
  ]);
}
