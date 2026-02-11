export interface PaneState {
  sidebarCollapsed: boolean;
  listCollapsed: boolean;
}

export type PaneCyclePhase = 0 | 1 | 2 | 3;

export type PaneCycleStepId =
  | "collapse-sidebar"
  | "collapse-list"
  | "expand-list"
  | "expand-sidebar";

export interface PaneCycleResult {
  nextPaneState: PaneState;
  nextPhase: PaneCyclePhase;
  appliedStep: PaneCycleStepId;
}

interface CycleStep {
  id: PaneCycleStepId;
  apply: (state: PaneState) => PaneState;
}

const CYCLE_STEPS: readonly CycleStep[] = [
  {
    id: "collapse-sidebar",
    apply: (state) => ({ ...state, sidebarCollapsed: true }),
  },
  {
    id: "collapse-list",
    apply: (state) => ({ ...state, listCollapsed: true }),
  },
  {
    id: "expand-list",
    apply: (state) => ({ ...state, listCollapsed: false }),
  },
  {
    id: "expand-sidebar",
    apply: (state) => ({ ...state, sidebarCollapsed: false }),
  },
];

function statesAreEqual(left: PaneState, right: PaneState): boolean {
  return (
    left.sidebarCollapsed === right.sidebarCollapsed &&
    left.listCollapsed === right.listCollapsed
  );
}

function toPhase(value: number): PaneCyclePhase {
  return (value % CYCLE_STEPS.length) as PaneCyclePhase;
}

export function advancePaneFocusCycle(
  currentPaneState: PaneState,
  currentPhase: PaneCyclePhase
): PaneCycleResult {
  for (let offset = 0; offset < CYCLE_STEPS.length; offset += 1) {
    const phase = toPhase(currentPhase + offset);
    const step = CYCLE_STEPS[phase];
    const candidateState = step.apply(currentPaneState);

    if (statesAreEqual(candidateState, currentPaneState)) {
      continue;
    }

    return {
      nextPaneState: candidateState,
      nextPhase: toPhase(phase + 1),
      appliedStep: step.id,
    };
  }

  const fallbackStep = CYCLE_STEPS[currentPhase];
  return {
    nextPaneState: currentPaneState,
    nextPhase: toPhase(currentPhase + 1),
    appliedStep: fallbackStep.id,
  };
}
