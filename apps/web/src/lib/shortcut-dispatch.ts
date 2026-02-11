/**
 * Pure keyboard shortcut resolver for feeds-workspace keydown events.
 */

import type { ShortcutActionId } from "@/components/keyboard-shortcuts";

export interface ShortcutEventSnapshot {
  key: string;
  metaKey: boolean;
  ctrlKey: boolean;
  altKey: boolean;
  shiftKey: boolean;
}

export interface ShortcutDispatchContext {
  enabled: boolean;
  isTypingTarget: boolean;
  isListContext: boolean;
  isReaderContext: boolean;
  isShortcutsModalOpen: boolean;
}

function normalizeKey(key: string): string {
  if (key.length === 1) {
    return key.toLowerCase();
  }

  return key;
}

function hasCommandModifier(snapshot: ShortcutEventSnapshot): boolean {
  return snapshot.metaKey || snapshot.ctrlKey || snapshot.altKey;
}

function isQuestionMark(snapshot: ShortcutEventSnapshot): boolean {
  const normalizedKey = normalizeKey(snapshot.key);
  return normalizedKey === "?" || (normalizedKey === "/" && snapshot.shiftKey);
}

/**
 * Resolve the current key event into a workspace action id.
 */
export function resolveShortcutAction(
  snapshot: ShortcutEventSnapshot,
  context: ShortcutDispatchContext
): ShortcutActionId | null {
  if (!context.enabled) {
    return null;
  }

  if (context.isShortcutsModalOpen) {
    if (!hasCommandModifier(snapshot) && snapshot.key === "Escape") {
      return "shortcuts.close";
    }

    return null;
  }

  if (context.isTypingTarget || hasCommandModifier(snapshot)) {
    return null;
  }

  const key = normalizeKey(snapshot.key);

  if (key === "j" && (context.isListContext || context.isReaderContext)) {
    return "article.next.vim";
  }

  if (key === "k" && (context.isListContext || context.isReaderContext)) {
    return "article.previous.vim";
  }

  if (key === "ArrowDown" && context.isListContext) {
    return "article.next.arrow";
  }

  if (key === "ArrowUp" && context.isListContext) {
    return "article.previous.arrow";
  }

  if (key === "Enter" && context.isListContext) {
    return "article.open";
  }

  if (isQuestionMark(snapshot)) {
    return "shortcuts.open";
  }

  if (key === "/") {
    return "search.focus";
  }

  if (key === "r") {
    return "feeds.refresh";
  }

  if (key === "f") {
    return "workspace.focusCycle";
  }

  return null;
}
