/**
 * Centered modal dialog for adding feeds, matching the shortcuts popup style.
 */

import { useEffect, useId, useRef } from "react";
import { AddFeedForm, type AddFeedFormProps } from "./AddFeedForm";
import styles from "./AddFeedDialog.module.css";

interface AddFeedDialogProps extends Omit<AddFeedFormProps, "onCancelAddFeed"> {
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

export function AddFeedDialog({ open, onClose, ...formProps }: AddFeedDialogProps) {
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
            Add feed
          </h2>
          <button
            type="button"
            className={styles.closeButton}
            onClick={onClose}
            aria-label="Close add feed dialog"
          >
            <span aria-hidden="true">x</span>
          </button>
        </div>

        <div className={styles.body}>
          <AddFeedForm {...formProps} presentation="dialog" onCancelAddFeed={onClose} />
        </div>
      </div>
    </div>
  );
}
