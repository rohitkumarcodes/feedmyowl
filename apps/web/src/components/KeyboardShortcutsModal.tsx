/**
 * Accessible keyboard shortcuts reference modal for the feeds workspace.
 */

import { useEffect, useId, useRef } from "react";
import { SHORTCUT_GROUPS } from "./keyboard-shortcuts";
import styles from "./KeyboardShortcutsModal.module.css";

interface KeyboardShortcutsModalProps {
  open: boolean;
  onClose: () => void;
}

const FOCUSABLE_SELECTOR =
  'a[href],button:not([disabled]),textarea:not([disabled]),input:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex="-1"])';

function getFocusableElements(root: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
    (element) => !element.hasAttribute("disabled")
  );
}

export function KeyboardShortcutsModal({ open, onClose }: KeyboardShortcutsModalProps) {
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    const dialog = dialogRef.current;
    if (!dialog) {
      return;
    }

    const previouslyFocused = document.activeElement;
    const focusable = getFocusableElements(dialog);
    focusable[0]?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }

      if (event.key !== "Tab") {
        return;
      }

      const focusTargets = getFocusableElements(dialog);
      if (focusTargets.length === 0) {
        event.preventDefault();
        return;
      }

      const first = focusTargets[0];
      const last = focusTargets[focusTargets.length - 1];
      const activeElement = document.activeElement;

      if (!dialog.contains(activeElement)) {
        event.preventDefault();
        first.focus();
        return;
      }

      if (event.shiftKey && activeElement === first) {
        event.preventDefault();
        last.focus();
        return;
      }

      if (!event.shiftKey && activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      if (previouslyFocused instanceof HTMLElement) {
        previouslyFocused.focus();
      }
    };
  }, [onClose, open]);

  if (!open) {
    return null;
  }

  return (
    <div className={styles.backdrop} role="presentation" onClick={onClose}>
      <div
        ref={dialogRef}
        className={styles.dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(event) => event.stopPropagation()}
      >
        <div className={styles.header}>
          <h2 id={titleId} className={styles.title}>
            Keyboard shortcuts
          </h2>
          <button
            type="button"
            className={styles.closeButton}
            onClick={onClose}
            aria-label="Close shortcuts dialog"
          >
            <span aria-hidden="true">x</span>
          </button>
        </div>

        <div className={styles.groups}>
          {SHORTCUT_GROUPS.map((group) => (
            <section key={group.id} className={styles.group}>
              <h3 className={styles.groupTitle}>{group.label}</h3>
              <div className={styles.rows}>
                {group.shortcuts.map((shortcut) => (
                  <div key={shortcut.id} className={styles.row}>
                    <div className={styles.keys}>
                      {shortcut.keys.map((key) => (
                        <kbd key={`${shortcut.id}-${key}`} className={styles.key}>
                          {key}
                        </kbd>
                      ))}
                    </div>
                    <p className={styles.rowDescription}>{shortcut.description}</p>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
