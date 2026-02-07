/**
 * Left sidebar showing a flat feed list and inline add/delete actions.
 */

import type { FormEvent } from "react";
import { AddFeedForm } from "./AddFeedForm";
import { FeedItem } from "./FeedItem";
import type { FeedViewModel } from "./feeds-types";
import styles from "./Sidebar.module.css";

export type SidebarScope = { type: "none" } | { type: "all" } | { type: "feed"; feedId: string };

interface SidebarProps {
  feeds: FeedViewModel[];
  selectedScope: SidebarScope;
  onSelectAll: () => void;
  onSelectFeed: (feedId: string) => void;

  isAddFeedFormVisible: boolean;
  feedUrlInput: string;
  isAddingFeed: boolean;
  isRefreshingFeeds: boolean;
  onShowAddFeedForm: () => void;
  onRefresh: () => void;
  onCancelAddFeed: () => void;
  onFeedUrlChange: (value: string) => void;
  onSubmitFeed: (event: FormEvent<HTMLFormElement>) => void;

  infoMessage: string | null;
  errorMessage: string | null;
  onDismissMessage: () => void;

  deletingFeedId: string | null;
  onRequestFeedDelete: (feedId: string) => void;

  onCollapse: () => void;
}

/**
 * Renders flat feed navigation and add-feed form.
 */
export function Sidebar({
  feeds,
  selectedScope,
  onSelectAll,
  onSelectFeed,
  isAddFeedFormVisible,
  feedUrlInput,
  isAddingFeed,
  isRefreshingFeeds,
  onShowAddFeedForm,
  onRefresh,
  onCancelAddFeed,
  onFeedUrlChange,
  onSubmitFeed,
  infoMessage,
  errorMessage,
  onDismissMessage,
  deletingFeedId,
  onRequestFeedDelete,
  onCollapse,
}: SidebarProps) {
  const sortedFeeds = [...feeds].sort((a, b) => {
    const aLabel = a.title || a.url;
    const bLabel = b.title || b.url;
    return aLabel.localeCompare(bLabel);
  });

  return (
    <nav className={styles.root} aria-label="Feed list" role="navigation">
      <div className={styles.top}>
        <div className={styles.controls}>
          <button
            type="button"
            className={`${styles.controlButton} ${
              selectedScope.type === "all" ? styles.controlButtonActive : ""
            }`}
            onClick={onSelectAll}
            aria-current={selectedScope.type === "all" ? "true" : undefined}
          >
            Read all feeds
          </button>

          <button
            type="button"
            className={styles.controlButton}
            onClick={onRefresh}
            disabled={isRefreshingFeeds}
          >
            {isRefreshingFeeds ? "⟳ Refreshing..." : "⟳ Refresh feeds"}
          </button>

          <button
            type="button"
            className={styles.controlButton}
            onClick={onShowAddFeedForm}
            disabled={isAddingFeed}
          >
            + Add a feed
          </button>
        </div>

        {isAddFeedFormVisible ? (
          <div className={styles.formWrap}>
            <AddFeedForm
              feedUrlInput={feedUrlInput}
              isAddingFeed={isAddingFeed}
              onFeedUrlChange={onFeedUrlChange}
              onSubmitFeed={onSubmitFeed}
              onCancelAddFeed={onCancelAddFeed}
            />
          </div>
        ) : null}

        {infoMessage ? (
          <div className={styles.sidebarMessage}>
            <span className={styles.sidebarMessageText}>{infoMessage}</span>
            <button
              type="button"
              className={styles.sidebarMessageDismiss}
              onClick={onDismissMessage}
              aria-label="Dismiss message"
            >
              x
            </button>
          </div>
        ) : null}

        {errorMessage ? (
          <div className={styles.sidebarMessage}>
            <span className={`${styles.sidebarMessageText} ${styles.sidebarMessageError}`}>
              {errorMessage}
            </span>
            <button
              type="button"
              className={styles.sidebarMessageDismiss}
              onClick={onDismissMessage}
              aria-label="Dismiss message"
            >
              x
            </button>
          </div>
        ) : null}
      </div>

      <div className={styles.sections}>
        {sortedFeeds.length === 0 ? (
          <p className={styles.emptyLabel}>No feeds yet.</p>
        ) : (
          sortedFeeds.map((feed) => {
            const label = feed.title || feed.url;
            const isActive = selectedScope.type === "feed" && selectedScope.feedId === feed.id;

            return (
              <FeedItem
                key={feed.id}
                label={label}
                isActive={isActive}
                isDeleting={deletingFeedId === feed.id}
                onSelect={() => onSelectFeed(feed.id)}
                onDelete={() => onRequestFeedDelete(feed.id)}
              />
            );
          })
        )}
      </div>

      <div className={styles.collapseBar}>
        <button
          type="button"
          className={styles.collapseButton}
          onClick={onCollapse}
          aria-label="Collapse sidebar"
          title="Collapse sidebar"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="3" y="3" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="2.5"/>
            <line x1="9" y1="3" x2="9" y2="21" stroke="currentColor" strokeWidth="2.5"/>
            <rect x="3" y="3" width="6" height="18" rx="2" fill="currentColor" fillOpacity="0.2"/>
          </svg>
        </button>
      </div>
    </nav>
  );
}
