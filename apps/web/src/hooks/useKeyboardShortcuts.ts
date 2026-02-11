/**
 * Registers focus-aware feed-reader keyboard shortcuts and routes actions to callbacks.
 */

import { useEffect } from "react";
import { resolveShortcutAction } from "@/lib/shortcut-dispatch";

interface UseKeyboardShortcutsOptions {
  enabled: boolean;
  isShortcutsModalOpen: boolean;
  isListContextTarget: (target: EventTarget | null) => boolean;
  isReaderContextTarget: (target: EventTarget | null) => boolean;
  onNextArticleVim: () => void;
  onPreviousArticleVim: () => void;
  onNextArticleArrow: () => void;
  onPreviousArticleArrow: () => void;
  onOpenArticle: () => void;
  onRefreshFeeds: () => void;
  onCycleFocusPanes: () => void;
  onFocusSearch: () => void;
  onOpenShortcuts: () => void;
  onCloseShortcuts: () => void;
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
 * Attaches document-level key handlers for navigation, refresh, and shortcuts help.
 */
export function useKeyboardShortcuts({
  enabled,
  isShortcutsModalOpen,
  isListContextTarget,
  isReaderContextTarget,
  onNextArticleVim,
  onPreviousArticleVim,
  onNextArticleArrow,
  onPreviousArticleArrow,
  onOpenArticle,
  onRefreshFeeds,
  onCycleFocusPanes,
  onFocusSearch,
  onOpenShortcuts,
  onCloseShortcuts,
}: UseKeyboardShortcutsOptions) {
  useEffect(() => {
    if (!enabled) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      const action = resolveShortcutAction(
        {
          key: event.key,
          metaKey: event.metaKey,
          ctrlKey: event.ctrlKey,
          altKey: event.altKey,
          shiftKey: event.shiftKey,
        },
        {
          enabled,
          isTypingTarget: isTypingTarget(event.target),
          isListContext: isListContextTarget(event.target),
          isReaderContext: isReaderContextTarget(event.target),
          isShortcutsModalOpen,
        }
      );

      if (!action) {
        return;
      }

      event.preventDefault();

      if (action === "article.next.vim") {
        onNextArticleVim();
        return;
      }

      if (action === "article.previous.vim") {
        onPreviousArticleVim();
        return;
      }

      if (action === "article.next.arrow") {
        onNextArticleArrow();
        return;
      }

      if (action === "article.previous.arrow") {
        onPreviousArticleArrow();
        return;
      }

      if (action === "article.open") {
        onOpenArticle();
        return;
      }

      if (action === "feeds.refresh") {
        onRefreshFeeds();
        return;
      }

      if (action === "workspace.focusCycle") {
        onCycleFocusPanes();
        return;
      }

      if (action === "search.focus") {
        onFocusSearch();
        return;
      }

      if (action === "shortcuts.open") {
        onOpenShortcuts();
        return;
      }

      if (action === "shortcuts.close") {
        onCloseShortcuts();
      }
    }

    document.addEventListener("keydown", handleKeyDown);

    return () => {
        document.removeEventListener("keydown", handleKeyDown);
      };
  }, [
    enabled,
    isListContextTarget,
    isReaderContextTarget,
    isShortcutsModalOpen,
    onNextArticleVim,
    onPreviousArticleVim,
    onNextArticleArrow,
    onPreviousArticleArrow,
    onCloseShortcuts,
    onCycleFocusPanes,
    onFocusSearch,
    onOpenArticle,
    onOpenShortcuts,
    onRefreshFeeds,
  ]);
}
