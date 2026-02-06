/**
 * Left sidebar showing feed folders, uncategorized feeds, inline add-feed/folder
 * forms, status messages, and pending context-menu actions.
 */

import type { FormEvent, MouseEvent } from "react";
import { FeedItem } from "./FeedItem";
import { FolderGroup } from "./FolderGroup";
import type { FeedViewModel, FolderViewModel, PendingAction } from "./feeds-types";
import styles from "./Sidebar.module.css";

export type SidebarScope =
  | { type: "all" }
  | { type: "folder"; folderId: string }
  | { type: "feed"; feedId: string };

interface SidebarProps {
  /* ── Feed & folder data ── */
  folders: FolderViewModel[];
  feeds: FeedViewModel[];
  expandedFolderIds: Set<string>;
  selectedScope: SidebarScope;

  /* ── Navigation callbacks ── */
  onSelectAll: () => void;
  onSelectFolder: (folderId: string) => void;
  onSelectFeed: (feedId: string) => void;
  onToggleFolder: (folderId: string) => void;
  onOpenFolderContextMenu: (
    folderId: string,
    event: MouseEvent<HTMLButtonElement>
  ) => void;
  onOpenFeedContextMenu: (
    feedId: string,
    event: MouseEvent<HTMLButtonElement>
  ) => void;

  /* ── Add Feed form state ── */
  isAddFeedFormVisible: boolean;
  feedUrlInput: string;
  feedFolderIdInput: string;
  isAddingFeed: boolean;
  onShowAddFeedForm: () => void;
  onCancelAddFeed: () => void;
  onFeedUrlChange: (value: string) => void;
  onFeedFolderIdChange: (value: string) => void;
  onSubmitFeed: (event: FormEvent<HTMLFormElement>) => void;

  /* ── Add Folder form state ── */
  isAddFolderFormVisible: boolean;
  folderNameInput: string;
  isAddingFolder: boolean;
  onShowAddFolderForm: () => void;
  onCancelAddFolder: () => void;
  onFolderNameChange: (value: string) => void;
  onSubmitFolder: (event: FormEvent<HTMLFormElement>) => void;

  /* ── Inline status messages ── */
  infoMessage: string | null;
  errorMessage: string | null;
  onDismissMessage: () => void;

  /* ── Pending context-menu actions (rename, move, delete) ── */
  pendingAction: PendingAction | null;
  isApplyingAction: boolean;
  onApplyPendingAction: () => void;
  onCancelPendingAction: () => void;
  onPendingActionChange: (action: PendingAction) => void;
}

/**
 * Renders the sidebar navigation, inline forms for adding feeds/folders,
 * status messages, and pending action confirmations.
 */
export function Sidebar({
  folders,
  feeds,
  expandedFolderIds,
  selectedScope,
  onSelectAll,
  onSelectFolder,
  onSelectFeed,
  onToggleFolder,
  onOpenFolderContextMenu,
  onOpenFeedContextMenu,
  isAddFeedFormVisible,
  feedUrlInput,
  feedFolderIdInput,
  isAddingFeed,
  onShowAddFeedForm,
  onCancelAddFeed,
  onFeedUrlChange,
  onFeedFolderIdChange,
  onSubmitFeed,
  isAddFolderFormVisible,
  folderNameInput,
  isAddingFolder,
  onShowAddFolderForm,
  onCancelAddFolder,
  onFolderNameChange,
  onSubmitFolder,
  infoMessage,
  errorMessage,
  onDismissMessage,
  pendingAction,
  isApplyingAction,
  onApplyPendingAction,
  onCancelPendingAction,
  onPendingActionChange,
}: SidebarProps) {
  const sortedFolders = [...folders].sort((a, b) => a.name.localeCompare(b.name));
  const sortedFeeds = [...feeds].sort((a, b) => {
    const aLabel = a.title || a.url;
    const bLabel = b.title || b.url;
    return aLabel.localeCompare(bLabel);
  });

  const feedsByFolder = new Map<string, FeedViewModel[]>();
  const uncategorizedFeeds: FeedViewModel[] = [];

  for (const feed of sortedFeeds) {
    if (feed.folderId) {
      const existing = feedsByFolder.get(feed.folderId) ?? [];
      existing.push(feed);
      feedsByFolder.set(feed.folderId, existing);
    } else {
      uncategorizedFeeds.push(feed);
    }
  }

  return (
    <div className={styles.root}>
      {/* ── Info / error messages at the very top ── */}
      {infoMessage ? (
        <div className={styles.sidebarMessage}>
          <span className={styles.sidebarMessageText}>{infoMessage}</span>
          <button
            type="button"
            className={styles.sidebarMessageDismiss}
            onClick={onDismissMessage}
            aria-label="Dismiss message"
          >
            ✕
          </button>
        </div>
      ) : null}
      {errorMessage ? (
        <div className={styles.sidebarMessage}>
          <span className={`${styles.sidebarMessageText} ${styles.sidebarMessageError}`}>
            Error: {errorMessage}
          </span>
          <button
            type="button"
            className={styles.sidebarMessageDismiss}
            onClick={onDismissMessage}
            aria-label="Dismiss error"
          >
            ✕
          </button>
        </div>
      ) : null}

      {/* ── Pending action (rename / move / delete confirmation) ── */}
      {pendingAction ? (
        <div className={styles.sidebarPendingAction}>
          {pendingAction.kind === "feed-delete" ? (
            <p>
              Delete feed &quot;{pendingAction.feedLabel}&quot; and all its stored
              articles?
            </p>
          ) : null}

          {pendingAction.kind === "folder-delete" ? (
            <p>
              Delete folder &quot;{pendingAction.folderLabel}&quot; and every
              feed/article inside it?
            </p>
          ) : null}

          {pendingAction.kind === "feed-rename" ? (
            <label className={styles.sidebarActionField}>
              <span className={styles.sidebarFormLabel}>Feed name</span>
              <input
                className={styles.sidebarFormInput}
                value={pendingAction.draftTitle}
                onChange={(event) =>
                  onPendingActionChange({
                    ...pendingAction,
                    draftTitle: event.currentTarget.value,
                  })
                }
              />
            </label>
          ) : null}

          {pendingAction.kind === "folder-rename" ? (
            <label className={styles.sidebarActionField}>
              <span className={styles.sidebarFormLabel}>Folder name</span>
              <input
                className={styles.sidebarFormInput}
                value={pendingAction.draftName}
                onChange={(event) =>
                  onPendingActionChange({
                    ...pendingAction,
                    draftName: event.currentTarget.value,
                  })
                }
              />
            </label>
          ) : null}

          {pendingAction.kind === "feed-move" ? (
            <label className={styles.sidebarActionField}>
              <span className={styles.sidebarFormLabel}>Move feed to folder</span>
              <select
                className={styles.sidebarFormSelect}
                value={pendingAction.draftFolderId}
                onChange={(event) =>
                  onPendingActionChange({
                    ...pendingAction,
                    draftFolderId: event.currentTarget.value,
                  })
                }
              >
                <option value="">Uncategorized</option>
                {sortedFolders.map((folder) => (
                  <option key={folder.id} value={folder.id}>
                    {folder.name}
                  </option>
                ))}
              </select>
            </label>
          ) : null}

          <div className={styles.sidebarFormActions}>
            <button
              type="button"
              className={styles.sidebarFormButton}
              onClick={onApplyPendingAction}
              disabled={isApplyingAction}
            >
              {isApplyingAction ? "Saving..." : "Confirm"}
            </button>
            <button
              type="button"
              className={styles.sidebarFormButton}
              onClick={onCancelPendingAction}
              disabled={isApplyingAction}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}

      <div className={styles.top}>
        <p className={styles.brand}>FEEDMYOWL</p>
        <FeedItem
          label="All feeds"
          isActive={selectedScope.type === "all"}
          onSelect={onSelectAll}
          onContextMenu={(event) => event.preventDefault()}
        />
        <div className={styles.topActions}>
          {/* ── + Add Feed toggle button ── */}
          <button
            type="button"
            className={styles.addFeedAffordance}
            onClick={onShowAddFeedForm}
          >
            + Add Feed
          </button>

          {/* Inline add-feed form, visible when toggled */}
          {isAddFeedFormVisible ? (
            <form className={styles.sidebarForm} onSubmit={onSubmitFeed}>
              <label className={styles.sidebarFormLabel} htmlFor="sidebar-feed-url">
                Feed URL
              </label>
              <input
                id="sidebar-feed-url"
                name="feed-url"
                type="url"
                required
                className={styles.sidebarFormInput}
                value={feedUrlInput}
                onChange={(event) => onFeedUrlChange(event.currentTarget.value)}
                placeholder="https://example.com/rss.xml"
              />

              <label className={styles.sidebarFormLabel} htmlFor="sidebar-feed-folder">
                Folder
              </label>
              <select
                id="sidebar-feed-folder"
                className={styles.sidebarFormSelect}
                value={feedFolderIdInput}
                onChange={(event) => onFeedFolderIdChange(event.currentTarget.value)}
              >
                <option value="">Uncategorized</option>
                {sortedFolders.map((folder) => (
                  <option key={folder.id} value={folder.id}>
                    {folder.name}
                  </option>
                ))}
              </select>

              <div className={styles.sidebarFormActions}>
                <button
                  type="submit"
                  className={styles.sidebarFormButton}
                  disabled={isAddingFeed}
                >
                  {isAddingFeed ? "Adding..." : "Add"}
                </button>
                <button
                  type="button"
                  className={styles.sidebarFormButton}
                  onClick={onCancelAddFeed}
                  disabled={isAddingFeed}
                >
                  Cancel
                </button>
              </div>
            </form>
          ) : null}

          {/* ── + Add Folder toggle button ── */}
          <button
            type="button"
            className={styles.addFeedAffordance}
            onClick={onShowAddFolderForm}
          >
            + Add Folder
          </button>

          {/* Inline add-folder form, visible when toggled */}
          {isAddFolderFormVisible ? (
            <form className={styles.sidebarForm} onSubmit={onSubmitFolder}>
              <label className={styles.sidebarFormLabel} htmlFor="sidebar-folder-name">
                Folder name
              </label>
              <input
                id="sidebar-folder-name"
                className={styles.sidebarFormInput}
                value={folderNameInput}
                onChange={(event) => onFolderNameChange(event.currentTarget.value)}
                placeholder="New folder"
              />

              <div className={styles.sidebarFormActions}>
                <button
                  type="submit"
                  className={styles.sidebarFormButton}
                  disabled={isAddingFolder}
                >
                  {isAddingFolder ? "Creating..." : "Create"}
                </button>
                <button
                  type="button"
                  className={styles.sidebarFormButton}
                  onClick={onCancelAddFolder}
                  disabled={isAddingFolder}
                >
                  Cancel
                </button>
              </div>
            </form>
          ) : null}
        </div>
      </div>

      <div className={styles.sections}>
        {sortedFolders.map((folder) => {
          const folderFeeds = feedsByFolder.get(folder.id) ?? [];
          const isSelected =
            selectedScope.type === "folder" && selectedScope.folderId === folder.id;

          return (
            <FolderGroup
              key={folder.id}
              label={folder.name}
              isExpanded={expandedFolderIds.has(folder.id)}
              isSelected={isSelected}
              onToggle={() => onToggleFolder(folder.id)}
              onSelect={() => onSelectFolder(folder.id)}
              onContextMenu={(event) => onOpenFolderContextMenu(folder.id, event)}
            >
              {folderFeeds.map((feed) => {
                const label = feed.title || feed.url;
                const isActive =
                  selectedScope.type === "feed" && selectedScope.feedId === feed.id;

                return (
                  <FeedItem
                    key={feed.id}
                    label={label}
                    isActive={isActive}
                    onSelect={() => onSelectFeed(feed.id)}
                    onContextMenu={(event) => onOpenFeedContextMenu(feed.id, event)}
                  />
                );
              })}
            </FolderGroup>
          );
        })}

        <section className={styles.uncategorizedSection}>
          <p className={styles.sectionHeader}>Uncategorized</p>
          {uncategorizedFeeds.length === 0 ? (
            <p className={styles.emptyLabel}>No uncategorized feeds</p>
          ) : (
            uncategorizedFeeds.map((feed) => {
              const label = feed.title || feed.url;
              const isActive =
                selectedScope.type === "feed" && selectedScope.feedId === feed.id;

              return (
                <FeedItem
                  key={feed.id}
                  label={label}
                  isActive={isActive}
                  onSelect={() => onSelectFeed(feed.id)}
                  onContextMenu={(event) => onOpenFeedContextMenu(feed.id, event)}
                />
              );
            })
          )}
        </section>
      </div>

    </div>
  );
}
