/**
 * Pure helper for arrow-key navigation within the sidebar (left pane).
 *
 * Steps a sidebar selection one row up or down within an ordered list of
 * currently-visible scopes. The visible-scope list is computed at runtime
 * by reading `[data-sidebar-row]` markers from the DOM (see
 * FeedsWorkspace.tsx) — this keeps a single source of truth for visual
 * order: the rendered tree itself.
 *
 * This file is framework-free so it can be unit-tested without React.
 */

import type { SidebarScope } from "@/features/feeds/types/scopes";

export interface ResolveSidebarArrowNavigationInput {
  step: 1 | -1;
  currentScope: SidebarScope;
  visibleScopes: SidebarScope[];
}

function scopeKey(scope: SidebarScope): string {
  switch (scope.type) {
    case "folder":
      return `folder:${scope.folderId}`;
    case "feed":
      return `feed:${scope.feedId}`;
    default:
      return scope.type;
  }
}

function findScopeIndex(scope: SidebarScope, scopes: SidebarScope[]): number {
  const key = scopeKey(scope);
  return scopes.findIndex((candidate) => scopeKey(candidate) === key);
}

/**
 * Steps the sidebar selection one row up or down within the visible list.
 * Clamps at boundaries (no wrap), matching the article-list arrow behaviour
 * in FeedsWorkspace.tsx.
 *
 * Returns the next scope to select, or null when there is nothing visible
 * (e.g. a fresh account with zero feeds and zero folders).
 */
export function resolveSidebarArrowNavigation(
  input: ResolveSidebarArrowNavigationInput,
): SidebarScope | null {
  const { step, currentScope, visibleScopes } = input;

  if (visibleScopes.length === 0) {
    return null;
  }

  const currentIndex =
    currentScope.type === "none" ? -1 : findScopeIndex(currentScope, visibleScopes);

  if (currentIndex < 0) {
    return step === 1 ? visibleScopes[0] : visibleScopes[visibleScopes.length - 1];
  }

  const nextIndex = Math.max(0, Math.min(visibleScopes.length - 1, currentIndex + step));

  return visibleScopes[nextIndex];
}

/**
 * Parses a `data-sidebar-row` attribute value into a SidebarScope.
 * Returns null for unrecognized values so callers can skip them safely.
 */
export function parseSidebarRowKey(rowKey: string): SidebarScope | null {
  if (rowKey === "saved" || rowKey === "all" || rowKey === "uncategorized") {
    return { type: rowKey };
  }

  if (rowKey.startsWith("folder:")) {
    return { type: "folder", folderId: rowKey.slice("folder:".length) };
  }

  if (rowKey.startsWith("feed:")) {
    return { type: "feed", feedId: rowKey.slice("feed:".length) };
  }

  return null;
}
