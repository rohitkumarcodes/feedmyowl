/**
 * Sidebar row for a single feed entry with an overflow action menu.
 */

import { useEffect, useRef, useState } from "react";
import styles from "./FeedItem.module.css";

interface FeedItemProps {
  label: string;
  isActive: boolean;
  isDeleting: boolean;
  onSelect: () => void;
  onDelete: () => void;
}

/**
 * Renders one feed row with active styling and an overflow control.
 */
export function FeedItem({
  label,
  isActive,
  isDeleting,
  onSelect,
  onDelete,
}: FeedItemProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const actionsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isMenuOpen) {
      return;
    }

    const handlePointerDown = (event: MouseEvent) => {
      if (!actionsRef.current?.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isMenuOpen]);

  useEffect(() => {
    if (isDeleting) {
      setIsMenuOpen(false);
    }
  }, [isDeleting]);

  const handleDelete = () => {
    setIsMenuOpen(false);
    onDelete();
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
          aria-expanded={isMenuOpen}
          disabled={isDeleting}
        >
          ⋯
        </button>

        {isMenuOpen ? (
          <div className={styles.menu} role="menu">
            <button
              type="button"
              className={styles.menuItem}
              role="menuitem"
              onClick={handleDelete}
              disabled={isDeleting}
            >
              {isDeleting ? "Deleting..." : "Delete"}
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
