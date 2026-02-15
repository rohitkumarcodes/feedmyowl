"use client";

export function BackIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        d="M10 6L4 12L10 18"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M5 12H20"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function TrashIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      className={className}
      aria-hidden="true"
    >
      <path d="M12 0c-4.992 0-10 1.242-10 3.144 0 .406 3.556 18.488 3.633 18.887 1.135 1.313 3.735 1.969 6.334 1.969 2.601 0 5.199-.656 6.335-1.969.081-.404 3.698-18.468 3.698-18.882 0-2.473-7.338-3.149-10-3.149zm0 1.86c4.211 0 7.624.746 7.624 1.667 0 .92-3.413 1.667-7.624 1.667s-7.625-.746-7.625-1.667 3.415-1.667 7.625-1.667zm4.469 19.139c-.777.532-2.418 1.001-4.502 1.001-2.081 0-3.72-.467-4.498-.998l-.004-.021c-1.552-7.913-2.414-12.369-2.894-14.882 3.55 1.456 11.304 1.455 14.849-.002-.868 4.471-2.434 12.322-2.951 14.902z" />
    </svg>
  );
}

export function KeyboardIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <rect
        x="3.5"
        y="6.5"
        width="17"
        height="11"
        rx="1.4"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <path d="M7 10H8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M10 10H11" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M13 10H14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M16 10H17" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path
        d="M7 13.5H17"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}
