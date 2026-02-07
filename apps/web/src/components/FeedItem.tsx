/**
 * Sidebar row for a single feed entry with a delete action.
 */

import styles from "./FeedItem.module.css";

interface FeedItemProps {
  label: string;
  isActive: boolean;
  isDeleting: boolean;
  onSelect: () => void;
  onDelete: () => void;
}

/**
 * Renders one feed row with active styling and a delete control.
 */
export function FeedItem({
  label,
  isActive,
  isDeleting,
  onSelect,
  onDelete,
}: FeedItemProps) {
  return (
    <div className={styles.rowWrap}>
      <button
        type="button"
        className={`${styles.row} ${isActive ? styles.rowActive : ""}`}
        onClick={onSelect}
        title={label}
        aria-current={isActive ? "true" : undefined}
      >
        <span className={styles.label}>{label}</span>
      </button>

      <div className={styles.actions}>
        <button type="button" onClick={onDelete} disabled={isDeleting}>
          {isDeleting ? "Deleting..." : "Delete"}
        </button>
      </div>
    </div>
  );
}
