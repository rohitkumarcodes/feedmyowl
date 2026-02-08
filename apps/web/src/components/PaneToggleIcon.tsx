interface PaneToggleIconProps {
  variant: "sidebar" | "list";
}

const paneFillXByVariant = {
  sidebar: 3,
  list: 9,
} as const;

/**
 * Geometric pane-map icon used for sidebar/list collapse and expand controls.
 */
export function PaneToggleIcon({ variant }: PaneToggleIconProps) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <rect
        x={paneFillXByVariant[variant]}
        y="3"
        width="6"
        height="18"
        fill="currentColor"
        fillOpacity="0.22"
      />
      <rect
        x="3"
        y="3"
        width="18"
        height="18"
        stroke="currentColor"
        strokeWidth="2.25"
        strokeLinejoin="miter"
      />
      <line
        x1="9"
        y1="3"
        x2="9"
        y2="21"
        stroke="currentColor"
        strokeWidth="2.25"
        strokeLinecap="square"
      />
      <line
        x1="15"
        y1="3"
        x2="15"
        y2="21"
        stroke="currentColor"
        strokeWidth="2.25"
        strokeLinecap="square"
      />
    </svg>
  );
}
