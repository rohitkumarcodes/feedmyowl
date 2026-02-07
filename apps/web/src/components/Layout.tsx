/**
 * Application shell with toolbar plus desktop panes / mobile view stack.
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
  toolbar,
  sidebar,
  articleList,
  articleReader,
  isSidebarCollapsed,
  onToggleSidebar,
  isMobile,
  mobileView,
  mobileListTitle,
  onMobileBackToFeeds,
  onMobileBackToArticles,
}: LayoutProps) {
  if (isMobile) {
    return (
      <div className={styles.root}>
        <div className={styles.toolbarRow}>{toolbar}</div>

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

  return (
    <div className={styles.root}>
      <div className={styles.toolbarRow}>{toolbar}</div>
      <div className={styles.panes}>
        <aside
          className={`${styles.sidebarPane} ${
            isSidebarCollapsed ? styles.sidebarPaneCollapsed : ""
          }`}
          aria-label="Feed list"
          role="navigation"
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

        <section className={styles.listPane} aria-label="Article list" role="region">
          {articleList}
        </section>

        <section className={styles.readerPane} aria-label="Article reader" role="main">
          {articleReader}
        </section>
      </div>
    </div>
  );
}
