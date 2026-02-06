/**
 * Three-pane application shell with toolbar, optional inline form area, and
 * independent pane containers for sidebar, article list, and reader.
 */

import { ReactNode } from "react";
import styles from "./Layout.module.css";

interface LayoutProps {
  toolbar: ReactNode;
  addFeedForm: ReactNode;
  statusPanel: ReactNode;
  sidebar: ReactNode;
  articleList: ReactNode;
  articleReader: ReactNode;
  isSidebarCollapsed: boolean;
}

/**
 * Renders the feed-reader layout matching the required three-pane structure.
 */
export function Layout({
  toolbar,
  addFeedForm,
  statusPanel,
  sidebar,
  articleList,
  articleReader,
  isSidebarCollapsed,
}: LayoutProps) {
  return (
    <div className={styles.root}>
      <div className={styles.toolbarRow}>{toolbar}</div>
      {addFeedForm ? <div className={styles.formRow}>{addFeedForm}</div> : null}
      {statusPanel ? <div className={styles.statusRow}>{statusPanel}</div> : null}
      <div className={styles.panes}>
        <aside
          className={`${styles.sidebarPane} ${
            isSidebarCollapsed ? styles.sidebarPaneCollapsed : ""
          }`}
          aria-label="Feeds sidebar"
        >
          {sidebar}
        </aside>
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
