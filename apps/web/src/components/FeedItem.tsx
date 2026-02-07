/**
 * Sidebar row for a single feed entry with inline actions.
 */

import styles from "./FeedItem.module.css";

interface FeedItemProps {
  label: string;
  isActive: boolean;
  onSelect: () => void;
  onRename: () => void;
  onMove: () => void;
  onDelete: () => void;
}

/**
 * Renders one feed row with subtle active styling and inline controls.
 */
export function FeedItem({
  label,
  isActive,
  onSelect,
  onRename,
  onMove,
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
        <button type="button" onClick={onRename}>
          Rename
        </button>
        <button type="button" onClick={onMove}>
          Move
        </button>
        <button type="button" onClick={onDelete}>
          Delete
        </button>
      </div>
    </div>
  );
}
