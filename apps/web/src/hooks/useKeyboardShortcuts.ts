/**
 * Registers focus-aware feed-reader keyboard shortcuts and routes actions to callbacks.
 */

import { useEffect } from "react";
import type { ActivePanel } from "@/features/feeds/state/active-panel";
import { resolveShortcutAction } from "@/lib/shared/shortcut-dispatch";

interface UseKeyboardShortcutsOptions {
  enabled: boolean;
  isShortcutsModalOpen: boolean;
  isListContextTarget: (target: EventTarget | null) => boolean;
  isReaderContextTarget: (target: EventTarget | null) => boolean;
  /**
   * Canonical "which pane is keyboard input for" state. Always points to a
   * visible pane — the FeedsWorkspace owner is responsible for advancing it
   * when the layout changes.
   */
  activePanel: ActivePanel;
  onNextArticleVim: () => void;
  onPreviousArticleVim: () => void;
  onNextArticleArrow: () => void;
  onPreviousArticleArrow: () => void;
  onNextSidebarItem: () => void;
  onPreviousSidebarItem: () => void;
  onReaderScrollLineDown: () => boolean;
  onReaderScrollLineUp: () => boolean;
  onReaderScrollPageDown: () => boolean;
  onReaderScrollPageUp: () => boolean;
  onCyclePanel: (direction: 1 | -1) => void;
  onOpenArticle: () => void;
  onToggleSaved: () => void;
  onOpenOriginal: () => void;
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

const READER_SCROLL_BLOCKED_SELECTOR = [
  "a",
  "button",
  "input",
  "textarea",
  "select",
  "summary",
  "audio",
  "video",
  "iframe",
  '[contenteditable=""]',
  '[contenteditable="true"]',
  '[contenteditable="plaintext-only"]',
  '[tabindex]:not([tabindex="-1"])',
].join(",");

function resolveTargetElement(target: EventTarget | null): Element | null {
  if (target instanceof Element) {
    return target;
  }

  if (target instanceof Node) {
    return target.parentElement;
  }

  return null;
}

function isReaderScrollBlockedTarget(target: EventTarget | null): boolean {
  const element = resolveTargetElement(target);
  if (!element || typeof element.closest !== "function") {
    return false;
  }

  return Boolean(element.closest(READER_SCROLL_BLOCKED_SELECTOR));
}

/**
 * Attaches document-level key handlers for navigation, refresh, and shortcuts help.
 */
export function useKeyboardShortcuts({
  enabled,
  isShortcutsModalOpen,
  isListContextTarget,
  isReaderContextTarget,
  activePanel,
  onNextArticleVim,
  onPreviousArticleVim,
  onNextArticleArrow,
  onPreviousArticleArrow,
  onNextSidebarItem,
  onPreviousSidebarItem,
  onReaderScrollLineDown,
  onReaderScrollLineUp,
  onReaderScrollPageDown,
  onReaderScrollPageUp,
  onCyclePanel,
  onOpenArticle,
  onToggleSaved,
  onOpenOriginal,
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
      // Routing priority: the canonical activePanel decides which pane owns
      // arrow keys, falling back to DOM-target checks for clicks inside list
      // or reader nodes (clicks in those panes update activePanel anyway, so
      // these are just safety nets for in-flight key events).
      const isListContext = activePanel === "list" || isListContextTarget(event.target);
      const isReaderContext =
        activePanel === "reader" || isReaderContextTarget(event.target);
      const isSidebarContext = activePanel === "sidebar";

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
          isListContext,
          isReaderContext,
          isSidebarContext,
          isShortcutsModalOpen,
        },
      );

      if (!action) {
        return;
      }

      if (action === "reader.scroll.lineDown") {
        if (isReaderScrollBlockedTarget(event.target)) {
          return;
        }

        if (onReaderScrollLineDown()) {
          event.preventDefault();
        }
        return;
      }

      if (action === "reader.scroll.lineUp") {
        if (isReaderScrollBlockedTarget(event.target)) {
          return;
        }

        if (onReaderScrollLineUp()) {
          event.preventDefault();
        }
        return;
      }

      if (action === "reader.scroll.pageDown") {
        if (isReaderScrollBlockedTarget(event.target)) {
          return;
        }

        if (onReaderScrollPageDown()) {
          event.preventDefault();
        }
        return;
      }

      if (action === "reader.scroll.pageUp") {
        if (isReaderScrollBlockedTarget(event.target)) {
          return;
        }

        if (onReaderScrollPageUp()) {
          event.preventDefault();
        }
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

      if (action === "sidebar.next.arrow") {
        onNextSidebarItem();
        return;
      }

      if (action === "sidebar.previous.arrow") {
        onPreviousSidebarItem();
        return;
      }

      if (action === "panel.next") {
        onCyclePanel(1);
        return;
      }

      if (action === "panel.previous") {
        onCyclePanel(-1);
        return;
      }

      if (action === "article.open") {
        onOpenArticle();
        return;
      }

      if (action === "article.toggleSaved") {
        onToggleSaved();
        return;
      }

      if (action === "article.openOriginal") {
        onOpenOriginal();
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
    activePanel,
    onNextArticleVim,
    onPreviousArticleVim,
    onNextArticleArrow,
    onPreviousArticleArrow,
    onNextSidebarItem,
    onPreviousSidebarItem,
    onReaderScrollLineDown,
    onReaderScrollLineUp,
    onReaderScrollPageDown,
    onReaderScrollPageUp,
    onCyclePanel,
    onCloseShortcuts,
    onCycleFocusPanes,
    onFocusSearch,
    onOpenArticle,
    onOpenOriginal,
    onOpenShortcuts,
    onRefreshFeeds,
    onToggleSaved,
  ]);
}
