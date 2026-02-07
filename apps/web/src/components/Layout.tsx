/**
 * Application shell with desktop panes / mobile view stack.
 */

import type { ReactNode } from "react";
import styles from "./Layout.module.css";

interface LayoutProps {
  sidebar: ReactNode;
  articleList: ReactNode;
  articleReader: ReactNode;
  sidebarCollapsed: boolean;
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
  sidebar,
  articleList,
  articleReader,
  sidebarCollapsed,
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

  const panesClassName = sidebarCollapsed
    ? `${styles.panes} ${styles.panesCollapsed}`
    : styles.panes;

  const sidebarPaneClassName = sidebarCollapsed
    ? `${styles.sidebarPane} ${styles.sidebarPaneCollapsed}`
    : styles.sidebarPane;

  return (
    <div className={styles.root}>
      <div className={panesClassName}>
        <aside className={sidebarPaneClassName} aria-label="Feed list" role="navigation">
          {sidebar}
        </aside>

        <section className={styles.listPane} aria-label="Article list" role="region">
          {sidebarCollapsed ? (
            <div className={styles.expandBar}>
              <button
                type="button"
                className={styles.expandButton}
                onClick={onToggleSidebar}
                aria-label="Expand sidebar"
                title="Expand sidebar"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <rect x="3" y="3" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="2.5"/>
                  <line x1="9" y1="3" x2="9" y2="21" stroke="currentColor" strokeWidth="2.5"/>
                  <rect x="3" y="3" width="6" height="18" rx="2" fill="currentColor" fillOpacity="0.2"/>
                </svg>
              </button>
            </div>
          ) : null}
          {articleList}
        </section>

        <section className={styles.readerPane} aria-label="Article reader" role="main">
          {articleReader}
        </section>
      </div>
    </div>
  );
}
