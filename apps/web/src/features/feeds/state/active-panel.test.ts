import { describe, expect, it } from "vitest";
import {
  cycleActivePanel,
  resolveActivePanelAfterLayoutChange,
  visiblePanels,
} from "./active-panel";

describe("active-panel", () => {
  it("lists all three panels when nothing is collapsed", () => {
    expect(visiblePanels({ sidebarCollapsed: false, listCollapsed: false })).toEqual([
      "sidebar",
      "list",
      "reader",
    ]);
  });

  it("omits the sidebar when it is collapsed", () => {
    expect(visiblePanels({ sidebarCollapsed: true, listCollapsed: false })).toEqual([
      "list",
      "reader",
    ]);
  });

  it("omits the list when it is collapsed", () => {
    expect(visiblePanels({ sidebarCollapsed: false, listCollapsed: true })).toEqual([
      "sidebar",
      "reader",
    ]);
  });

  it("only shows the reader when both sidebar and list are collapsed", () => {
    expect(visiblePanels({ sidebarCollapsed: true, listCollapsed: true })).toEqual([
      "reader",
    ]);
  });

  it("keeps the active panel if it is still visible", () => {
    expect(
      resolveActivePanelAfterLayoutChange("list", {
        sidebarCollapsed: true,
        listCollapsed: false,
      }),
    ).toBe("list");
  });

  it("falls back to the rightmost visible panel when the active one is hidden", () => {
    expect(
      resolveActivePanelAfterLayoutChange("sidebar", {
        sidebarCollapsed: true,
        listCollapsed: false,
      }),
    ).toBe("reader");
    expect(
      resolveActivePanelAfterLayoutChange("list", {
        sidebarCollapsed: true,
        listCollapsed: true,
      }),
    ).toBe("reader");
  });

  it("cycles forward through visible panels and clamps at the right edge", () => {
    const state = { sidebarCollapsed: false, listCollapsed: false };
    expect(cycleActivePanel("sidebar", 1, state)).toBe("list");
    expect(cycleActivePanel("list", 1, state)).toBe("reader");
    expect(cycleActivePanel("reader", 1, state)).toBe("reader");
  });

  it("cycles backward through visible panels and clamps at the left edge", () => {
    const state = { sidebarCollapsed: false, listCollapsed: false };
    expect(cycleActivePanel("reader", -1, state)).toBe("list");
    expect(cycleActivePanel("list", -1, state)).toBe("sidebar");
    expect(cycleActivePanel("sidebar", -1, state)).toBe("sidebar");
  });

  it("skips collapsed panels when cycling", () => {
    const state = { sidebarCollapsed: true, listCollapsed: false };
    expect(cycleActivePanel("list", -1, state)).toBe("list");
    expect(cycleActivePanel("list", 1, state)).toBe("reader");
    expect(cycleActivePanel("reader", -1, state)).toBe("list");
  });

  it("recovers when the current active panel was collapsed away", () => {
    expect(
      cycleActivePanel("sidebar", 1, {
        sidebarCollapsed: true,
        listCollapsed: true,
      }),
    ).toBe("reader");
  });
});
