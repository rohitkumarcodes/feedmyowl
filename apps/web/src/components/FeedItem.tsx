/**
 * Sidebar row for a single feed entry with an overflow action menu.
 */

import { useEffect, useRef, useState, type FormEvent } from "react";
import styles from "./FeedItem.module.css";

interface FeedItemProps {
  label: string;
  isActive: boolean;
  isDeleting: boolean;
  isRenaming: boolean;
  onSelect: () => void;
  onDelete: () => void;
  onRename: (name: string) => void | Promise<void>;
}

/**
 * Renders one feed row with active styling and an overflow control.
 */
export function FeedItem({
  label,
  isActive,
  isDeleting,
  isRenaming,
  onSelect,
  onDelete,
  onRename,
}: FeedItemProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isRenameOpen, setIsRenameOpen] = useState(false);
  const [renameValue, setRenameValue] = useState(label);
  const actionsRef = useRef<HTMLDivElement>(null);
  const renameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isMenuOpen && !isRenameOpen) {
      return;
    }

    const handlePointerDown = (event: MouseEvent) => {
      if (!actionsRef.current?.contains(event.target as Node)) {
        setIsMenuOpen(false);
        setIsRenameOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsMenuOpen(false);
        setIsRenameOpen(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isMenuOpen, isRenameOpen]);

  useEffect(() => {
    if (isDeleting) {
      setIsMenuOpen(false);
      setIsRenameOpen(false);
    }
  }, [isDeleting]);

  useEffect(() => {
    if (!isRenameOpen) {
      return;
    }

    setRenameValue(label);
    window.setTimeout(() => {
      renameInputRef.current?.focus();
      renameInputRef.current?.select();
    }, 0);
  }, [isRenameOpen, label]);

  const handleDelete = () => {
    setIsMenuOpen(false);
    setIsRenameOpen(false);
    onDelete();
  };

  const handleOpenRename = () => {
    setRenameValue(label);
    setIsMenuOpen(false);
    setIsRenameOpen(true);
  };

  const handleRenameSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (isRenaming) {
      return;
    }

    await onRename(renameValue);
    setIsRenameOpen(false);
    setIsMenuOpen(false);
  };

  return (
    <div className={`${styles.rowWrap} ${isActive ? styles.rowWrapActive : ""}`}>
      <button
        type="button"
        className={`${styles.row} ${isActive ? styles.rowActive : ""}`}
        onClick={onSelect}
        title={label}
        aria-current={isActive ? "true" : undefined}
      >
        <span className={styles.label}>{label}</span>
      </button>

      <div className={styles.actions} ref={actionsRef}>
        <button
          type="button"
          className={styles.menuTrigger}
          onClick={() => setIsMenuOpen((previous) => !previous)}
          aria-label={`Open actions for ${label}`}
          aria-haspopup="menu"
          aria-expanded={isMenuOpen || isRenameOpen}
          disabled={isDeleting || isRenaming || isRenameOpen}
        >
          ⋯
        </button>

        {isRenameOpen ? (
          <div className={styles.renamePopover} role="dialog" aria-label={`Edit name for ${label}`}>
            <form className={styles.renameForm} onSubmit={handleRenameSubmit}>
              <input
                ref={renameInputRef}
                type="text"
                value={renameValue}
                onChange={(event) => setRenameValue(event.target.value)}
                className={styles.renameInput}
                placeholder="Feed name"
                maxLength={255}
                disabled={isRenaming}
              />
              <div className={styles.renameActions}>
                <button
                  type="submit"
                  className={styles.renameButton}
                  disabled={isRenaming}
                >
                  {isRenaming ? "Saving..." : "Save"}
                </button>
                <button
                  type="button"
                  className={styles.renameButton}
                  onClick={() => setIsRenameOpen(false)}
                  disabled={isRenaming}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        ) : null}

        {isMenuOpen ? (
          <div className={styles.menu} role="menu">
            <button
              type="button"
              className={styles.menuItem}
              role="menuitem"
              onClick={handleOpenRename}
              disabled={isDeleting || isRenaming}
            >
              Edit name
            </button>
            <button
              type="button"
              className={styles.menuItem}
              role="menuitem"
              onClick={handleDelete}
              disabled={isDeleting || isRenaming}
            >
              {isDeleting ? "Deleting..." : "Delete"}
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
