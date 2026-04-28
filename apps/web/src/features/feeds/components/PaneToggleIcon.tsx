interface PaneToggleIconProps {
  collapsed: boolean;
}

/**
 * Panel-collapse glyph used for the pane visibility toggles.
 * Reads as "this control hides/shows a pane" — a panel outline with a
 * filled edge bar on the side that collapses, plus a chevron whose
 * direction tracks the current state (left = pane will collapse,
 * right = pane will expand).
 */
export function PaneToggleIcon({ collapsed }: PaneToggleIconProps) {
  const chevron = collapsed ? "M14 9l3 3-3 3" : "M17 9l-3 3 3 3";

  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <rect
        x="3.5"
        y="4.5"
        width="17"
        height="15"
        rx="2"
        stroke="currentColor"
        strokeWidth="1.75"
      />
      <line
        x1="9"
        y1="4.5"
        x2="9"
        y2="19.5"
        stroke="currentColor"
        strokeWidth="1.75"
      />
      <path
        d={chevron}
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
