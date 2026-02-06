/**
 * Top toolbar with refresh, search, add-feed, and sidebar toggle controls.
 */

import type { RefObject } from "react";
import styles from "./Toolbar.module.css";

interface ToolbarProps {
  query: string;
  searchInputRef: RefObject<HTMLInputElement | null>;
  isRefreshing: boolean;
  isSidebarCollapsed: boolean;
  onQueryChange: (query: string) => void;
  onRefresh: () => void;
  onToggleAddFeedForm: () => void;
  onToggleSidebar: () => void;
}

/**
 * Renders the top control row used by keyboard and pointer interactions.
 */
export function Toolbar({
  query,
  searchInputRef,
  isRefreshing,
  isSidebarCollapsed,
  onQueryChange,
  onRefresh,
  onToggleAddFeedForm,
  onToggleSidebar,
}: ToolbarProps) {
  return (
    <div className={styles.root}>
      <button
        type="button"
        className={styles.controlButton}
        onClick={onRefresh}
        disabled={isRefreshing}
      >
        {isRefreshing ? "Refreshing..." : "Refresh"}
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
        className={styles.controlButton}
        onClick={onToggleAddFeedForm}
      >
        + Add Feed
      </button>

      <button
        type="button"
        className={styles.controlButton}
        onClick={onToggleSidebar}
      >
        {isSidebarCollapsed ? "Show Sidebar" : "Hide Sidebar"}
      </button>
    </div>
  );
}
