"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { useSelectedLayoutSegment } from "next/navigation";
import { UserMenu } from "@/lib/auth-client";
import { emitOpenShortcutsDialogEvent } from "@/lib/shortcuts-dialog-events";
import styles from "./layout.module.css";

/**
 * Renders a fixed top-right options trigger for account and app actions.
 */
export function AccountControls() {
  const selectedSegment = useSelectedLayoutSegment();
  const [isOptionsOpen, setIsOptionsOpen] = useState(false);
  const controlsRef = useRef<HTMLDivElement>(null);
  const dialogId = useId();
  const showShortcutsAction = selectedSegment === "feeds";
  const optionsToggleLabel = isOptionsOpen ? "Close options" : "Open options";

  useEffect(() => {
    if (!isOptionsOpen) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") {
        return;
      }

      event.preventDefault();
      setIsOptionsOpen(false);
    };

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOptionsOpen]);

  useEffect(() => {
    setIsOptionsOpen(false);
  }, [selectedSegment]);

  useEffect(() => {
    if (!isOptionsOpen) {
      return;
    }

    const handlePointerDown = (event: MouseEvent) => {
      if (!controlsRef.current?.contains(event.target as Node)) {
        setIsOptionsOpen(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
    };
  }, [isOptionsOpen]);

  const handleOpenShortcuts = () => {
    emitOpenShortcutsDialogEvent();
    setIsOptionsOpen(false);
  };

  return (
    <div className={styles.accountControls} ref={controlsRef}>
      <button
        type="button"
        className={styles.optionsTrigger}
        onClick={() => setIsOptionsOpen((previous) => !previous)}
        aria-label={optionsToggleLabel}
        title={optionsToggleLabel}
        aria-haspopup="dialog"
        aria-expanded={isOptionsOpen}
        aria-controls={dialogId}
      >
        <span aria-hidden="true">{isOptionsOpen ? "x" : "⋯"}</span>
      </button>

      <div
        id={dialogId}
        className={`${styles.optionsPopover} ${isOptionsOpen ? styles.optionsPopoverOpen : ""}`}
        role="dialog"
        aria-modal="false"
        aria-hidden={!isOptionsOpen}
        aria-label="Options"
      >
        <div className={styles.optionsActions}>
          <div className={styles.optionsActionSlot}>
            <UserMenu
              afterSignOutUrl="/sign-in"
              appearance={{
                variables: {
                  colorPrimary: "var(--accent)",
                  colorBackground: "var(--bg-primary)",
                  colorForeground: "var(--text-primary)",
                  colorMutedForeground: "var(--text-secondary)",
                  colorInput: "var(--bg-primary)",
                  colorInputForeground: "var(--text-primary)",
                  colorBorder: "var(--border)",
                  fontFamily: "var(--font-sans)",
                  fontSize: "0.9375rem",
                  borderRadius: "0px",
                },
                elements: {
                  userButtonTrigger: styles.optionsClerkButton,
                  userButtonAvatarBox: styles.accountMenuAvatar,
                },
              }}
            />
          </div>

          <Link
            href="/settings"
            className={styles.optionsActionButton}
            onClick={() => setIsOptionsOpen(false)}
          >
            <svg
              className={styles.optionsActionIcon}
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              aria-hidden="true"
            >
              <path
                d="M9.75 3.5H14.25L14.9 5.9C15.25 6.05 15.58 6.24 15.88 6.47L18.2 5.85L20.45 9.75L18.72 11.45C18.75 11.63 18.75 11.82 18.75 12C18.75 12.18 18.75 12.37 18.72 12.55L20.45 14.25L18.2 18.15L15.88 17.53C15.58 17.76 15.25 17.95 14.9 18.1L14.25 20.5H9.75L9.1 18.1C8.75 17.95 8.42 17.76 8.12 17.53L5.8 18.15L3.55 14.25L5.28 12.55C5.25 12.37 5.25 12.18 5.25 12C5.25 11.82 5.25 11.63 5.28 11.45L3.55 9.75L5.8 5.85L8.12 6.47C8.42 6.24 8.75 6.05 9.1 5.9L9.75 3.5Z"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <circle cx="12" cy="12" r="2.5" stroke="currentColor" strokeWidth="1.5" />
            </svg>
            <span>Settings</span>
          </Link>

          {showShortcutsAction ? (
            <button
              type="button"
              className={styles.optionsActionButton}
              onClick={handleOpenShortcuts}
            >
              <svg
                className={styles.optionsActionIcon}
                width="14"
                height="14"
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
                <path d="M7 13.5H17" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              </svg>
              <span>Keyboard shortcuts</span>
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
