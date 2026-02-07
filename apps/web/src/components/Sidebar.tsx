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
  onShowAddFeedForm: () => void;
  onCancelAddFeed: () => void;
  onFeedUrlChange: (value: string) => void;
  onSubmitFeed: (event: FormEvent<HTMLFormElement>) => void;

  infoMessage: string | null;
  errorMessage: string | null;
  onDismissMessage: () => void;

  deletingFeedId: string | null;
  onRequestFeedDelete: (feedId: string, feedLabel: string) => void;
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
  onShowAddFeedForm,
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
        <div className={styles.brandRow}>
          <p className={styles.brand}>FEEDMYOWL</p>
        </div>

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
        <button
          type="button"
          className={`${styles.allArticlesButton} ${
            selectedScope.type === "all" ? styles.allArticlesButtonActive : ""
          }`}
          onClick={onSelectAll}
          aria-current={selectedScope.type === "all" ? "true" : undefined}
        >
          All articles
        </button>

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
                onDelete={() => onRequestFeedDelete(feed.id, label)}
              />
            );
          })
        )}
      </div>

      <div className={styles.bottomActions}>
        <button
          type="button"
          className={styles.addFeedAffordance}
          onClick={onShowAddFeedForm}
        >
          + Add Feed
        </button>

        {isAddFeedFormVisible ? (
          <AddFeedForm
            feedUrlInput={feedUrlInput}
            isAddingFeed={isAddingFeed}
            onFeedUrlChange={onFeedUrlChange}
            onSubmitFeed={onSubmitFeed}
            onCancelAddFeed={onCancelAddFeed}
          />
        ) : null}
      </div>
    </nav>
  );
}
