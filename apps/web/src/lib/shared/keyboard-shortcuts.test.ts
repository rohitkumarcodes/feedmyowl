import { describe, expect, it } from "vitest";
import {
  getShortcutKeyLabel,
  SHORTCUT_DEFINITIONS,
  SHORTCUT_GROUPS,
} from "./keyboard-shortcuts";

describe("keyboard-shortcuts definitions", () => {
  it("covers all definitions in grouped output", () => {
    const groupedIds = SHORTCUT_GROUPS.flatMap((group) =>
      group.shortcuts.map((shortcut) => shortcut.id),
    );
    const allIds = SHORTCUT_DEFINITIONS.map((shortcut) => shortcut.id);

    expect(groupedIds.sort()).toEqual(allIds.sort());
  });

  it("keeps expected group order and labels", () => {
    expect(SHORTCUT_GROUPS.map((group) => group.id)).toEqual([
      "navigation",
      "reading_actions",
      "app_actions",
    ]);
    expect(SHORTCUT_GROUPS.map((group) => group.label)).toEqual([
      "Navigation",
      "Reading actions",
      "App actions",
    ]);
  });

  it("defines all required public-facing shortcut keys", () => {
    const keys = SHORTCUT_DEFINITIONS.flatMap((shortcut) => shortcut.keys);

    expect(keys).toContain("j");
    expect(keys).toContain("k");
    expect(keys).toContain("ArrowDown");
    expect(keys).toContain("ArrowUp");
    expect(keys).toContain("ArrowLeft");
    expect(keys).toContain("ArrowRight");
    expect(keys).toContain("Space");
    expect(keys).toContain("Shift+Space");
    expect(keys).toContain("Enter");
    expect(keys).toContain("r");
    expect(keys).toContain("f");
    expect(keys).toContain("/");
    expect(keys).toContain("?");
    expect(keys).toContain("Escape");
  });

  it("uses compact display labels for long key names", () => {
    expect(getShortcutKeyLabel("ArrowDown")).toBe("↓");
    expect(getShortcutKeyLabel("ArrowUp")).toBe("↑");
    expect(getShortcutKeyLabel("ArrowLeft")).toBe("←");
    expect(getShortcutKeyLabel("ArrowRight")).toBe("→");
    expect(getShortcutKeyLabel("Escape")).toBe("Esc");
    expect(getShortcutKeyLabel("Space")).toBe("Space");
    expect(getShortcutKeyLabel("Shift+Space")).toBe("Shift + Space");
  });

  it("describes vim navigation as opening articles", () => {
    const nextVim = SHORTCUT_DEFINITIONS.find(
      (shortcut) => shortcut.id === "article.next.vim",
    );
    const previousVim = SHORTCUT_DEFINITIONS.find(
      (shortcut) => shortcut.id === "article.previous.vim",
    );

    expect(nextVim?.description).toContain("Open next article");
    expect(previousVim?.description).toContain("Open previous article");
  });

  it("documents vertical arrows once for context-specific navigation", () => {
    const arrowShortcuts = SHORTCUT_DEFINITIONS.filter((shortcut) =>
      shortcut.keys.some((key) => key === "ArrowUp" || key === "ArrowDown"),
    );

    expect(arrowShortcuts).toHaveLength(1);
    expect(arrowShortcuts[0]?.id).toBe("navigation.verticalArrows");
    expect(arrowShortcuts[0]?.description).toBe(
      "Move selection in sidebar/list; scroll reader",
    );
  });

  it("keeps Space as the primary reader paging shortcut", () => {
    const pageDown = SHORTCUT_DEFINITIONS.find(
      (shortcut) => shortcut.id === "reader.scroll.pageDown",
    );
    const pageUp = SHORTCUT_DEFINITIONS.find(
      (shortcut) => shortcut.id === "reader.scroll.pageUp",
    );

    expect(pageDown?.keys).toEqual(["Space"]);
    expect(pageDown?.description).toContain("PageDown");
    expect(pageUp?.keys).toEqual(["Shift+Space"]);
    expect(pageUp?.description).toContain("PageUp");
  });
});
