/**
 * Canonical keyboard shortcut definitions for the feeds workspace.
 */

export type ShortcutActionId =
  | "article.next.vim"
  | "article.previous.vim"
  | "article.next.arrow"
  | "article.previous.arrow"
  | "article.open"
  | "feeds.refresh"
  | "workspace.focusCycle"
  | "search.focus"
  | "shortcuts.open"
  | "shortcuts.close";

export type ShortcutGroupId = "navigation" | "reading_actions" | "app_actions";

export interface ShortcutDefinition {
  id: ShortcutActionId;
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

export const SHORTCUT_DEFINITIONS: readonly ShortcutDefinition[] = [
  {
    id: "article.next.vim",
    group: "navigation",
    keys: ["j"],
    description: "Select next article (list or reader)",
  },
  {
    id: "article.previous.vim",
    group: "navigation",
    keys: ["k"],
    description: "Select previous article (list or reader)",
  },
  {
    id: "article.next.arrow",
    group: "navigation",
    keys: ["ArrowDown"],
    description: "Select next article (list only)",
  },
  {
    id: "article.previous.arrow",
    group: "navigation",
    keys: ["ArrowUp"],
    description: "Select previous article (list only)",
  },
  {
    id: "article.open",
    group: "reading_actions",
    keys: ["Enter"],
    description: "Open selected article (list only)",
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
  })
);
