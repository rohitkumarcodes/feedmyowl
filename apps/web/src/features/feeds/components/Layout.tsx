/**
 * Application shell with desktop panes / mobile view stack.
 */

import { useRef, type ReactNode } from "react";
import primitiveStyles from "./LeftPanePrimitives.module.css";
import styles from "./Layout.module.css";
import { PaneToggleIcon } from "./PaneToggleIcon";
import { useSwipeBack } from "@/features/feeds/hooks/useSwipeBack";
import type { ActivePanel } from "@/features/feeds/state/active-panel";

interface LayoutProps {
  sidebar: ReactNode;
  articleList: ReactNode;
  articleReader: ReactNode;
  sidebarCollapsed: boolean;
  onToggleSidebar: () => void;
  listCollapsed: boolean;
  onToggleList: () => void;
  /**
   * Which pane keyboard input currently targets. Surfaced as a data attribute
   * so CSS can paint a subtle indicator on the active pane.
   */
  activePanel: ActivePanel;
  isMobile: boolean;
  mobileView: "feeds" | "articles" | "reader";
  mobileListTitle: string;
  onMobileBackToFeeds: () => void;
  onMobileBackToArticles: () => void;
}

interface PaneToggleProps {
  collapsed: boolean;
  onToggle: () => void;
  active: boolean;
  paneNoun: string;
}

/**
 * Toggle button anchored to the top-right corner of a collapsible pane.
 * State-aware: announces and tooltips itself dynamically, exposes
 * `aria-pressed` so screen readers report the collapsed/expanded state.
 */
function PaneToggle({ collapsed, onToggle, active, paneNoun }: PaneToggleProps) {
  const label = collapsed ? `Show ${paneNoun}` : `Hide ${paneNoun}`;
  return (
    <button
      type="button"
      className={`${primitiveStyles.iconButton} ${primitiveStyles.iconButtonSurface} ${styles.paneToggleButton} ${active ? styles.paneToggleButtonActive : ""}`}
      onClick={onToggle}
      aria-pressed={collapsed}
      aria-label={label}
    >
      <PaneToggleIcon collapsed={collapsed} />
    </button>
  );
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
  onToggleList,
  activePanel,
  isMobile,
  mobileView,
  mobileListTitle,
  onMobileBackToFeeds,
  onMobileBackToArticles,
}: LayoutProps) {
  const mobileContainerRef = useRef<HTMLDivElement>(null);

  useSwipeBack({
    containerRef: mobileContainerRef,
    mobileView,
    onMobileBackToFeeds,
    onMobileBackToArticles,
  });

  if (isMobile) {
    const viewIndex = mobileView === "feeds" ? 0 : mobileView === "articles" ? 1 : 2;

    return (
      <div className={`${styles.root} ${primitiveStyles.tokenScope}`}>
        <div className={styles.mobileViews} ref={mobileContainerRef}>
          <div
            className={styles.mobileSlideTrack}
            style={{ transform: `translateX(-${viewIndex * 100}%)` }}
          >
            <nav
              className={styles.mobileSlidePane}
              aria-label="Feed list"
              role="navigation"
              aria-hidden={mobileView !== "feeds"}
            >
              {sidebar}
            </nav>

            <section
              className={styles.mobileSlidePane}
              aria-label="Article list"
              role="region"
              aria-hidden={mobileView !== "articles"}
            >
              <div className={styles.mobileBackRow}>
                <button type="button" onClick={onMobileBackToFeeds}>
                  ← Feeds
                </button>
                <p>{mobileListTitle}</p>
              </div>
              {articleList}
            </section>

            <section
              className={styles.mobileSlidePane}
              aria-label="Article reader"
              role="main"
              aria-hidden={mobileView !== "reader"}
            >
              <div className={styles.mobileBackRow}>
                <button type="button" onClick={onMobileBackToArticles}>
                  ← Articles
                </button>
              </div>
              {articleReader}
            </section>
          </div>
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

  return (
    <div className={`${styles.root} ${primitiveStyles.tokenScope}`}>
      <div className={panesClassName} data-active-panel={activePanel}>
        <aside className={sidebarPaneClassName} aria-label="Feed list" role="navigation">
          <div className={styles.paneToggleAnchor}>
            <PaneToggle
              collapsed={sidebarCollapsed}
              onToggle={onToggleSidebar}
              active={activePanel === "sidebar"}
              paneNoun="sidebar"
            />
          </div>
          <div className={styles.paneContent} aria-hidden={sidebarCollapsed}>
            {sidebar}
          </div>
        </aside>

        <section className={listPaneClassName} aria-label="Article list" role="region">
          <div className={styles.paneToggleAnchor}>
            <PaneToggle
              collapsed={listCollapsed}
              onToggle={onToggleList}
              active={activePanel === "list"}
              paneNoun="article list"
            />
          </div>
          <div className={styles.paneContent} aria-hidden={listCollapsed}>
            {articleList}
          </div>
        </section>

        <section className={styles.readerPane} aria-label="Article reader" role="main">
          {articleReader}
        </section>
      </div>
    </div>
  );
}
