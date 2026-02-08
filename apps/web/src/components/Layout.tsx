/**
 * Application shell with desktop panes / mobile view stack.
 */

import type { ReactNode } from "react";
import primitiveStyles from "./LeftPanePrimitives.module.css";
import styles from "./Layout.module.css";
import { PaneToggleIcon } from "./PaneToggleIcon";

interface LayoutProps {
  sidebar: ReactNode;
  articleList: ReactNode;
  articleReader: ReactNode;
  sidebarCollapsed: boolean;
  onToggleSidebar: () => void;
  listCollapsed: boolean;
  onCollapseList: () => void;
  onToggleList: () => void;
  isMobile: boolean;
  mobileView: "feeds" | "articles" | "reader";
  mobileListTitle: string;
  onMobileBackToFeeds: () => void;
  onMobileBackToArticles: () => void;
}

/**
 * Renders the feed-reader layout with desktop panes and mobile view navigation.
 */
export function Layout({
  sidebar,
  articleList,
  articleReader,
  sidebarCollapsed,
  onToggleSidebar,
  listCollapsed,
  onCollapseList,
  onToggleList,
  isMobile,
  mobileView,
  mobileListTitle,
  onMobileBackToFeeds,
  onMobileBackToArticles,
}: LayoutProps) {
  if (isMobile) {
    return (
      <div className={`${styles.root} ${primitiveStyles.tokenScope}`}>
        <div className={styles.mobileViews}>
          {mobileView === "feeds" ? (
            <nav className={styles.mobilePane} aria-label="Feed list" role="navigation">
              {sidebar}
            </nav>
          ) : null}

          {mobileView === "articles" ? (
            <section className={styles.mobilePane} aria-label="Article list" role="region">
              <div className={styles.mobileBackRow}>
                <button type="button" onClick={onMobileBackToFeeds}>
                  ← Feeds
                </button>
                <p>{mobileListTitle}</p>
              </div>
              {articleList}
            </section>
          ) : null}

          {mobileView === "reader" ? (
            <section className={styles.mobilePane} aria-label="Article reader" role="main">
              <div className={styles.mobileBackRow}>
                <button type="button" onClick={onMobileBackToArticles}>
                  ← Articles
                </button>
              </div>
              {articleReader}
            </section>
          ) : null}
        </div>
      </div>
    );
  }

  /* Build grid class based on which panels are collapsed. */
  let panesClassName = styles.panes;
  if (sidebarCollapsed && listCollapsed) {
    panesClassName = `${styles.panes} ${styles.panesBothCollapsed}`;
  } else if (sidebarCollapsed) {
    panesClassName = `${styles.panes} ${styles.panesSidebarCollapsed}`;
  } else if (listCollapsed) {
    panesClassName = `${styles.panes} ${styles.panesListCollapsed}`;
  }

  const sidebarPaneClassName = sidebarCollapsed
    ? `${styles.sidebarPane} ${styles.sidebarPaneCollapsed}`
    : styles.sidebarPane;

  const listPaneClassName = listCollapsed
    ? `${styles.listPane} ${styles.listPaneCollapsed}`
    : styles.listPane;

  /* Position the list expand tab at the left edge of the reader pane. */
  const listExpandClassName = sidebarCollapsed
    ? `${styles.listExpandToggle} ${styles.listExpandToggleSidebarCollapsed}`
    : styles.listExpandToggle;

  return (
    <div className={`${styles.root} ${primitiveStyles.tokenScope}`}>
      {/* Sidebar expand tab — bottom-left, visible when sidebar is collapsed */}
      {sidebarCollapsed ? (
        <div className={styles.sidebarExpandToggle}>
          <button
            type="button"
            className={`${primitiveStyles.iconButton} ${primitiveStyles.iconButtonSurface} ${styles.paneToggleButton} ${styles.expandButton}`}
            onClick={onToggleSidebar}
            aria-label="Expand sidebar"
            title="Expand sidebar"
          >
            <PaneToggleIcon variant="sidebar" />
          </button>
        </div>
      ) : null}

      {/* List expand tab — bottom, at the left edge of reader pane */}
      {listCollapsed ? (
        <div className={listExpandClassName}>
          <button
            type="button"
            className={`${primitiveStyles.iconButton} ${primitiveStyles.iconButtonSurface} ${styles.paneToggleButton} ${styles.expandButton}`}
            onClick={onToggleList}
            aria-label="Expand article list"
            title="Expand article list"
          >
            <PaneToggleIcon variant="list" />
          </button>
        </div>
      ) : null}

      <div className={panesClassName}>
        <aside className={sidebarPaneClassName} aria-label="Feed list" role="navigation">
          {sidebar}
        </aside>

        <section className={listPaneClassName} aria-label="Article list" role="region">
          <div className={styles.listPaneContent}>
            {articleList}
          </div>
          <div className={styles.collapseBar}>
            <button
              type="button"
              className={`${primitiveStyles.iconButton} ${styles.paneToggleButton}`}
              onClick={onCollapseList}
              aria-label="Collapse article list"
              title="Collapse article list"
            >
              <PaneToggleIcon variant="list" />
            </button>
          </div>
        </section>

        <section className={styles.readerPane} aria-label="Article reader" role="main">
          {articleReader}
        </section>
      </div>
    </div>
  );
}
