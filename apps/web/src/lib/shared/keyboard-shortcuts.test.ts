import { describe, expect, it } from "vitest";
import { SHORTCUT_DEFINITIONS, SHORTCUT_GROUPS } from "./keyboard-shortcuts";

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

  it("defines all required public-facing shortcut actions", () => {
    const keys = SHORTCUT_DEFINITIONS.flatMap((shortcut) => shortcut.keys);

    expect(keys).toContain("j");
    expect(keys).toContain("k");
    expect(keys).toContain("ArrowDown");
    expect(keys).toContain("ArrowUp");
    expect(keys).toContain("PageDown");
    expect(keys).toContain("PageUp");
    expect(keys).toContain("Space");
    expect(keys).toContain("Shift+Space");
    expect(keys).toContain("Enter");
    expect(keys).toContain("r");
    expect(keys).toContain("f");
    expect(keys).toContain("/");
    expect(keys).toContain("?");
    expect(keys).toContain("Escape");
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

  it("documents dual Arrow key behavior for list and reader contexts", () => {
    const listArrowDown = SHORTCUT_DEFINITIONS.find(
      (shortcut) => shortcut.id === "article.next.arrow",
    );
    const readerArrowDown = SHORTCUT_DEFINITIONS.find(
      (shortcut) => shortcut.id === "reader.scroll.lineDown",
    );

    expect(listArrowDown?.description).toContain("list");
    expect(readerArrowDown?.description).toContain("reader");
  });
});
