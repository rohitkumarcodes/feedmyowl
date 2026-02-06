/**
 * Sidebar row for a single feed entry.
 */

import styles from "./FeedItem.module.css";
import type { MouseEvent } from "react";

interface FeedItemProps {
  label: string;
  isActive: boolean;
  onSelect: () => void;
  onContextMenu: (event: MouseEvent<HTMLButtonElement>) => void;
}

/**
 * Renders one feed row with subtle active styling and context-menu support.
 */
export function FeedItem({
  label,
  isActive,
  onSelect,
  onContextMenu,
}: FeedItemProps) {
  return (
    <button
      type="button"
      className={`${styles.row} ${isActive ? styles.rowActive : ""}`}
      onClick={onSelect}
      onContextMenu={onContextMenu}
      title={label}
    >
      <span className={styles.label}>{label}</span>
    </button>
  );
}
