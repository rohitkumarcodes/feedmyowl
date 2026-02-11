import { describe, expect, it } from "vitest";
import {
  advancePaneFocusCycle,
  type PaneCyclePhase,
} from "./pane-focus-cycle";

describe("pane-focus-cycle", () => {
  it("cycles through sidebar collapse, list collapse, list expand, and sidebar expand", () => {
    const states: Array<{ sidebarCollapsed: boolean; listCollapsed: boolean }> = [];
    let phase: PaneCyclePhase = 0;
    let currentState = { sidebarCollapsed: false, listCollapsed: false };
    states.push(currentState);

    for (let index = 0; index < 4; index += 1) {
      const result = advancePaneFocusCycle(currentState, phase);
      currentState = result.nextPaneState;
      phase = result.nextPhase;
      states.push(currentState);
    }

    expect(states).toEqual([
      { sidebarCollapsed: false, listCollapsed: false },
      { sidebarCollapsed: true, listCollapsed: false },
      { sidebarCollapsed: true, listCollapsed: true },
      { sidebarCollapsed: true, listCollapsed: false },
      { sidebarCollapsed: false, listCollapsed: false },
    ]);
  });

  it("suppresses no-op steps and advances to the next state-changing step", () => {
    const result = advancePaneFocusCycle(
      {
        sidebarCollapsed: true,
        listCollapsed: false,
      },
      0
    );

    expect(result.appliedStep).toBe("collapse-list");
    expect(result.nextPaneState).toEqual({
      sidebarCollapsed: true,
      listCollapsed: true,
    });
    expect(result.nextPhase).toBe(2);
  });

  it("behaves deterministically from arbitrary state and phase", () => {
    const first = advancePaneFocusCycle(
      {
        sidebarCollapsed: false,
        listCollapsed: true,
      },
      3
    );

    expect(first.appliedStep).toBe("collapse-sidebar");
    expect(first.nextPaneState).toEqual({
      sidebarCollapsed: true,
      listCollapsed: true,
    });
    expect(first.nextPhase).toBe(1);

    const second = advancePaneFocusCycle(first.nextPaneState, first.nextPhase);
    expect(second.appliedStep).toBe("expand-list");
    expect(second.nextPaneState).toEqual({
      sidebarCollapsed: true,
      listCollapsed: false,
    });
    expect(second.nextPhase).toBe(3);
  });
});
