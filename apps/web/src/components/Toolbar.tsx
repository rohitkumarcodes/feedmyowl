/**
 * Top toolbar with sidebar toggle, refresh, and search controls.
 * Order left-to-right: Hide/Show Sidebar | ⟳ Refresh | Search
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
  onToggleSidebar,
}: ToolbarProps) {
  return (
    <div className={styles.root}>
      {/* Sidebar visibility toggle — leftmost control */}
      <button
        type="button"
        className={styles.controlButton}
        onClick={onToggleSidebar}
        aria-label={isSidebarCollapsed ? "Show sidebar" : "Hide sidebar"}
      >
        {isSidebarCollapsed ? "Show Sidebar" : "Hide Sidebar"}
      </button>

      {/* Feed refresh trigger with unicode glyph */}
      <button
        type="button"
        className={styles.controlButton}
        onClick={onRefresh}
        disabled={isRefreshing}
      >
        {isRefreshing ? "⟳ Refreshing..." : "⟳ Refresh"}
      </button>

      {/* Client-side search filter for the current article list */}
      <input
        ref={searchInputRef}
        type="search"
        value={query}
        onChange={(event) => onQueryChange(event.currentTarget.value)}
        placeholder="Search"
        className={styles.searchInput}
        aria-label="Search current article list"
      />

    </div>
  );
}
