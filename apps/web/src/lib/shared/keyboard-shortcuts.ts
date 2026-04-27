/**
 * Canonical keyboard shortcut definitions for the feeds workspace.
 */

export type ShortcutActionId =
  | "article.next.vim"
  | "article.previous.vim"
  | "article.next.arrow"
  | "article.previous.arrow"
  | "sidebar.next.arrow"
  | "sidebar.previous.arrow"
  | "reader.scroll.lineDown"
  | "reader.scroll.lineUp"
  | "reader.scroll.pageDown"
  | "reader.scroll.pageUp"
  | "panel.next"
  | "panel.previous"
  | "article.open"
  | "article.toggleSaved"
  | "article.openOriginal"
  | "feeds.refresh"
  | "workspace.focusCycle"
  | "search.focus"
  | "shortcuts.open"
  | "shortcuts.close";

export type ShortcutGroupId = "navigation" | "reading_actions" | "app_actions";

export type ShortcutDefinitionId = ShortcutActionId | "navigation.verticalArrows";

export interface ShortcutDefinition {
  id: ShortcutDefinitionId;
  group: ShortcutGroupId;
  keys: readonly string[];
  description: string;
}

export interface ShortcutGroup {
  id: ShortcutGroupId;
  label: string;
  shortcuts: ShortcutDefinition[];
}

const SHORTCUT_GROUP_ORDER: ShortcutGroupId[] = [
  "navigation",
  "reading_actions",
  "app_actions",
];

const SHORTCUT_GROUP_LABELS: Record<ShortcutGroupId, string> = {
  navigation: "Navigation",
  reading_actions: "Reading actions",
  app_actions: "App actions",
};

const SHORTCUT_KEY_LABELS: Record<string, string> = {
  ArrowDown: "↓",
  ArrowLeft: "←",
  ArrowRight: "→",
  ArrowUp: "↑",
  Escape: "Esc",
  Space: "Space",
  "Shift+Space": "Shift + Space",
};

export function getShortcutKeyLabel(key: string): string {
  return SHORTCUT_KEY_LABELS[key] ?? key;
}

export const SHORTCUT_DEFINITIONS: readonly ShortcutDefinition[] = [
  {
    id: "article.next.vim",
    group: "navigation",
    keys: ["j"],
    description: "Open next article (list/reader, continues across feed lists)",
  },
  {
    id: "article.previous.vim",
    group: "navigation",
    keys: ["k"],
    description: "Open previous article (list/reader, continues across feed lists)",
  },
  {
    id: "navigation.verticalArrows",
    group: "navigation",
    keys: ["ArrowUp", "ArrowDown"],
    description: "Move selection in sidebar/list; scroll reader",
  },
  {
    id: "panel.next",
    group: "navigation",
    keys: ["ArrowRight"],
    description: "Move focus to the next visible pane",
  },
  {
    id: "panel.previous",
    group: "navigation",
    keys: ["ArrowLeft"],
    description: "Move focus to the previous visible pane",
  },
  {
    id: "article.open",
    group: "reading_actions",
    keys: ["Enter"],
    description: "Open selected article (list only)",
  },
  {
    id: "reader.scroll.pageDown",
    group: "reading_actions",
    keys: ["Space"],
    description: "Scroll down one reading page with overlap (also PageDown)",
  },
  {
    id: "reader.scroll.pageUp",
    group: "reading_actions",
    keys: ["Shift+Space"],
    description: "Scroll up one reading page with overlap (also PageUp)",
  },
  {
    id: "article.toggleSaved",
    group: "reading_actions",
    keys: ["s"],
    description: "Save / unsave article",
  },
  {
    id: "article.openOriginal",
    group: "reading_actions",
    keys: ["o"],
    description: "Open original article in new tab",
  },
  {
    id: "feeds.refresh",
    group: "app_actions",
    keys: ["r"],
    description: "Refresh feeds",
  },
  {
    id: "workspace.focusCycle",
    group: "app_actions",
    keys: ["f"],
    description: "Cycle pane focus (sidebar -> list -> reader -> all panes)",
  },
  {
    id: "search.focus",
    group: "app_actions",
    keys: ["/"],
    description: "Focus article search",
  },
  {
    id: "shortcuts.open",
    group: "app_actions",
    keys: ["?"],
    description: "Open keyboard shortcuts",
  },
  {
    id: "shortcuts.close",
    group: "app_actions",
    keys: ["Escape"],
    description: "Close shortcuts dialog",
  },
];

export const SHORTCUT_GROUPS: readonly ShortcutGroup[] = SHORTCUT_GROUP_ORDER.map(
  (groupId) => ({
    id: groupId,
    label: SHORTCUT_GROUP_LABELS[groupId],
    shortcuts: SHORTCUT_DEFINITIONS.filter((shortcut) => shortcut.group === groupId),
  }),
);
