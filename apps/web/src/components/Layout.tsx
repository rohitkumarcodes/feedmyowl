/**
 * Two-row application shell with a toolbar and three reader panes.
 */

import type { ReactNode } from "react";
import styles from "./Layout.module.css";

interface LayoutProps {
  toolbar: ReactNode;
  sidebar: ReactNode;
  articleList: ReactNode;
  articleReader: ReactNode;
  isSidebarCollapsed: boolean;
  onToggleSidebar: () => void;
}

/**
 * Renders the feed-reader layout with optional collapsed sidebar state.
 */
export function Layout({
  toolbar,
  sidebar,
  articleList,
  articleReader,
  isSidebarCollapsed,
  onToggleSidebar,
}: LayoutProps) {
  return (
    <div className={styles.root}>
      <div className={styles.toolbarRow}>{toolbar}</div>
      <div className={styles.panes}>
        <aside
          className={`${styles.sidebarPane} ${
            isSidebarCollapsed ? styles.sidebarPaneCollapsed : ""
          }`}
          aria-label="Feeds sidebar"
        >
          {sidebar}
        </aside>

        {isSidebarCollapsed ? (
          <button
            type="button"
            className={styles.showSidebarButton}
            onClick={onToggleSidebar}
          >
            Show Sidebar
          </button>
        ) : null}

        <section className={styles.listPane} aria-label="Article list pane">
          {articleList}
        </section>

        <section className={styles.readerPane} aria-label="Reader pane">
          {articleReader}
        </section>
      </div>
    </div>
  );
}
