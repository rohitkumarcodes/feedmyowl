/**
 * Three-pane application shell with toolbar, optional inline form area, and
 * independent pane containers for sidebar, article list, and reader.
 * The article list pane width is adjustable via a drag handle.
 */

import type { ReactNode, MouseEvent as ReactMouseEvent } from "react";
import styles from "./Layout.module.css";

interface LayoutProps {
  toolbar: ReactNode;
  addFeedForm: ReactNode;
  statusPanel: ReactNode;
  sidebar: ReactNode;
  articleList: ReactNode;
  articleReader: ReactNode;
  isSidebarCollapsed: boolean;
  /** Current width of the article list pane in pixels. */
  listPaneWidth: number;
  /** Called when the user starts dragging the resize handle between list and reader. */
  onListPaneResizeStart: (event: ReactMouseEvent<HTMLDivElement>) => void;
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
  listPaneWidth,
  onListPaneResizeStart,
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
        <section
          className={styles.listPane}
          aria-label="Article list pane"
          style={{ width: `${listPaneWidth}px` }}
        >
          {articleList}
        </section>
        {/* Draggable resize handle between article list and reader panes */}
        <div
          className={styles.resizeHandle}
          onMouseDown={onListPaneResizeStart}
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize article list"
        />
        <section className={styles.readerPane} aria-label="Reader pane">
          {articleReader}
        </section>
      </div>
    </div>
  );
}
