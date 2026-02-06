/**
 * Left sidebar showing feed folders, uncategorized feeds, and add-feed affordance.
 */

import type { MouseEvent } from "react";
import { FeedItem } from "./FeedItem";
import { FolderGroup } from "./FolderGroup";
import type { FeedViewModel, FolderViewModel } from "./feeds-types";
import styles from "./Sidebar.module.css";

export type SidebarScope =
  | { type: "all" }
  | { type: "folder"; folderId: string }
  | { type: "feed"; feedId: string };

interface SidebarProps {
  folders: FolderViewModel[];
  feeds: FeedViewModel[];
  expandedFolderIds: Set<string>;
  selectedScope: SidebarScope;
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
  onShowAddFeedForm: () => void;
  onShowAddFolderForm: () => void;
}

/**
 * Renders the sidebar navigation and grouping structure for feeds.
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
  onShowAddFeedForm,
  onShowAddFolderForm,
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
      <div className={styles.top}>
        <p className={styles.brand}>FEEDMYOWL</p>
        <FeedItem
          label="All feeds"
          isActive={selectedScope.type === "all"}
          onSelect={onSelectAll}
          onContextMenu={(event) => event.preventDefault()}
        />
        <div className={styles.topActions}>
          <button
            type="button"
            className={styles.addFeedAffordance}
            onClick={onShowAddFeedForm}
          >
            + Add Feed
          </button>
          <button
            type="button"
            className={styles.addFeedAffordance}
            onClick={onShowAddFolderForm}
          >
            + Add Folder
          </button>
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
