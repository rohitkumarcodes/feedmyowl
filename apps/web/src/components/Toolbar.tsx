/**
 * Top toolbar with refresh, search, and add-feed controls.
 */

import type { RefObject } from "react";
import styles from "./Toolbar.module.css";

interface ToolbarProps {
  query: string;
  searchInputRef: RefObject<HTMLInputElement | null>;
  isRefreshing: boolean;
  onQueryChange: (query: string) => void;
  onRefresh: () => void;
  onShowAddFeedForm: () => void;
}

/**
 * Renders the thin control bar above the three-pane reader layout.
 */
export function Toolbar({
  query,
  searchInputRef,
  isRefreshing,
  onQueryChange,
  onRefresh,
  onShowAddFeedForm,
}: ToolbarProps) {
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

      <input
        ref={searchInputRef}
        type="search"
        value={query}
        onChange={(event) => onQueryChange(event.currentTarget.value)}
        placeholder="Search"
        className={styles.searchInput}
        aria-label="Search current article list"
      />

      <button
        type="button"
        className={styles.addFeedButton}
        onClick={onShowAddFeedForm}
      >
        + Add Feed
      </button>
    </div>
  );
}
