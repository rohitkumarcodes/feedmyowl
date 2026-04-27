interface PaneToggleIconProps {
  direction: "left" | "right";
}

const chevronPath = "M15 4l-8 8 8 8";

/**
 * Directional chevron arrow used for collapse/expand controls.
 * Rotates 180deg between left and right states for a smooth toggle affordance.
 */
export function PaneToggleIcon({ direction }: PaneToggleIconProps) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      style={{
        transform: direction === "right" ? "rotate(180deg)" : "rotate(0deg)",
        transition: "transform 0.2s ease",
      }}
    >
      <path
        d={chevronPath}
        stroke="currentColor"
        strokeWidth="2.25"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
