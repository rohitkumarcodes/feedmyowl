/**
 * Left sidebar showing a flat feed list and inline add/delete actions.
 */

import type { FormEvent } from "react";
import { AddFeedForm } from "./AddFeedForm";
import { FeedItem } from "./FeedItem";
import type { FeedViewModel } from "./feeds-types";
import styles from "./Sidebar.module.css";

export type SidebarScope = { type: "all" } | { type: "feed"; feedId: string };

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
    </nav>
  );
}
