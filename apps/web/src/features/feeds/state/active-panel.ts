/**
 * Pure helpers for the canonical "active panel" — the single source of truth
 * for which workspace pane (sidebar / article list / reader) keyboard input
 * targets. The active panel is always one of the visible panes; collapsing
 * the active pane must advance it to the next visible neighbour.
 */

import type { PaneState } from "./pane-focus-cycle";

export type ActivePanel = "sidebar" | "list" | "reader";

const PANEL_ORDER: readonly ActivePanel[] = ["sidebar", "list", "reader"];

/**
 * Returns the panels currently visible on screen, in left-to-right order.
 * The reader is always visible; sidebar and list visibility follow the
 * collapse flags.
 */
export function visiblePanels(state: PaneState): ActivePanel[] {
  const out: ActivePanel[] = [];
  if (!state.sidebarCollapsed) out.push("sidebar");
  if (!state.listCollapsed) out.push("list");
  out.push("reader");
  return out;
}

/**
 * Resolves the panel a freshly-mutated layout should land on. If the current
 * active panel is still visible, keep it; otherwise fall back to the nearest
 * visible neighbour (preferring the left, since collapsing typically pushes
 * focus rightward toward the reader).
 */
export function resolveActivePanelAfterLayoutChange(
  current: ActivePanel,
  state: PaneState,
): ActivePanel {
  const visible = visiblePanels(state);
  if (visible.includes(current)) {
    return current;
  }
  return visible[visible.length - 1];
}

/**
 * Steps the active panel left or right through the visible panels. Clamps at
 * the edges (no wrap) — clamping is less surprising for arrow keys, and a
 * dedicated cycle key (Tab/F) can offer wrap behaviour separately.
 */
export function cycleActivePanel(
  current: ActivePanel,
  direction: 1 | -1,
  state: PaneState,
): ActivePanel {
  const visible = visiblePanels(state);
  const index = visible.indexOf(current);
  if (index < 0) {
    return resolveActivePanelAfterLayoutChange(current, state);
  }
  const nextIndex = Math.max(0, Math.min(visible.length - 1, index + direction));
  return visible[nextIndex];
}

export const ALL_ACTIVE_PANELS = PANEL_ORDER;
