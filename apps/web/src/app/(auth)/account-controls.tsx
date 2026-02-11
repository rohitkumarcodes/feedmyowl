"use client";

import Link from "next/link";
import { useEffect, useId, useState } from "react";
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
  const dialogTitleId = useId();
  const showShortcutsAction = selectedSegment === "feeds";

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

  const handleOpenShortcuts = () => {
    emitOpenShortcutsDialogEvent();
    setIsOptionsOpen(false);
  };

  return (
    <div className={styles.accountControls}>
      <button
        type="button"
        className={styles.optionsTrigger}
        onClick={() => setIsOptionsOpen((previous) => !previous)}
        aria-label="Open options"
        title="Open options"
        aria-haspopup="dialog"
        aria-expanded={isOptionsOpen}
      >
        <span aria-hidden="true">⋯</span>
      </button>

      {isOptionsOpen ? (
        <div
          className={styles.optionsBackdrop}
          role="presentation"
          onClick={() => setIsOptionsOpen(false)}
        >
          <div
            className={styles.optionsDialog}
            role="dialog"
            aria-modal="true"
            aria-labelledby={dialogTitleId}
            onClick={(event) => event.stopPropagation()}
          >
            <div className={styles.optionsHeader}>
              <h2 id={dialogTitleId} className={styles.optionsTitle}>
                Options
              </h2>
              <button
                type="button"
                className={styles.optionsCloseButton}
                onClick={() => setIsOptionsOpen(false)}
                aria-label="Close options dialog"
              >
                <span aria-hidden="true">x</span>
              </button>
            </div>

            <div className={styles.optionsActions}>
              {showShortcutsAction ? (
                <button
                  type="button"
                  className={styles.optionsActionButton}
                  onClick={handleOpenShortcuts}
                >
                  Keyboard shortcuts
                </button>
              ) : null}

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

              <Link
                href="/settings"
                className={styles.optionsActionButton}
                onClick={() => setIsOptionsOpen(false)}
              >
                Settings
              </Link>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
