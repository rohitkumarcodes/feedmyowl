/**
 * Top toolbar with a single refresh control.
 */

import styles from "./Toolbar.module.css";

interface ToolbarProps {
  isRefreshing: boolean;
  onRefresh: () => void;
}

/**
 * Renders a minimal control bar above the reader layout.
 */
export function Toolbar({ isRefreshing, onRefresh }: ToolbarProps) {
  return (
    <div className={styles.root}>
      <button
        type="button"
        className={styles.controlButton}
        onClick={onRefresh}
        disabled={isRefreshing}
      >
        {isRefreshing ? "⟳ Refreshing..." : "⟳ Refresh"}
      </button>
    </div>
  );
}
