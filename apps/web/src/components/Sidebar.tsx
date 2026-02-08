/**
 * Left sidebar showing global scopes, folder tree, and feed actions.
 */

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { AddFeedForm } from "./AddFeedForm";
import { FeedItem } from "./FeedItem";
import type { FeedViewModel, FolderViewModel } from "./feeds-types";
import { getFeedLabel } from "./feeds-workspace.selectors";
import styles from "./Sidebar.module.css";

export type SidebarScope =
  | { type: "none" }
  | { type: "all" }
  | { type: "uncategorized" }
  | { type: "folder"; folderId: string }
  | { type: "feed"; feedId: string };

type FolderDeleteMode = "remove_only" | "remove_and_unsubscribe_exclusive";

interface SidebarProps {
  feeds: FeedViewModel[];
  folders: FolderViewModel[];
  selectedScope: SidebarScope;
  isMobile: boolean;
  onSelectAll: () => void;
  onSelectUncategorized: () => void;
  onSelectFolder: (folderId: string) => void;
  onSelectFeed: (feedId: string) => void;

  isAddFeedFormVisible: boolean;
  feedUrlInput: string;
  addFeedFolderIds: string[];
  addFeedNewFolderNameInput: string;
  isAddingFeed: boolean;
  isRefreshingFeeds: boolean;
  isCreatingFolder: boolean;
  onShowAddFeedForm: () => void;
  onRefresh: () => void;
  onCancelAddFeed: () => void;
  onFeedUrlChange: (value: string) => void;
  onToggleAddFeedFolder: (folderId: string) => void;
  onAddFeedNewFolderNameChange: (value: string) => void;
  onCreateFolderFromAddFeed: () => void;
  onSubmitFeed: (event: FormEvent<HTMLFormElement>) => void;

  infoMessage: string | null;
  errorMessage: string | null;
  onDismissMessage: () => void;

  deletingFeedId: string | null;
  renamingFeedId: string | null;
  updatingFeedFoldersId: string | null;
  onRequestFeedDelete: (feedId: string) => void;
  onRequestFeedRename: (feedId: string, name: string) => boolean | Promise<boolean>;
  onRequestFeedFolderUpdate: (
    feedId: string,
    folderIds: string[]
  ) => boolean | Promise<boolean>;

  deletingFolderId: string | null;
  renamingFolderId: string | null;
  onCreateFolder: (name: string) => boolean | Promise<boolean>;
  onRequestFolderRename: (
    folderId: string,
    name: string
  ) => boolean | Promise<boolean>;
  onRequestFolderDelete: (
    folderId: string,
    mode: FolderDeleteMode
  ) => Promise<boolean>;

  onCollapse: () => void;
}

interface FolderRowProps {
  folder: FolderViewModel;
  isMobile: boolean;
  feedCount: number;
  isActive: boolean;
  isExpanded: boolean;
  isDeleting: boolean;
  isRenaming: boolean;
  onToggleExpand: () => void;
  onSelectFolder: () => void;
  onRenameFolder: (name: string) => Promise<boolean>;
  onPromptDeleteFolder: () => void;
}

function FolderRow({
  folder,
  isMobile,
  feedCount,
  isActive,
  isExpanded,
  isDeleting,
  isRenaming,
  onToggleExpand,
  onSelectFolder,
  onRenameFolder,
  onPromptDeleteFolder,
}: FolderRowProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isRenameOpen, setIsRenameOpen] = useState(false);
  const [renameValue, setRenameValue] = useState(folder.name);
  const actionsRef = useRef<HTMLDivElement>(null);
  const renameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isMenuOpen && !isRenameOpen) {
      return;
    }

    const handlePointerDown = (event: MouseEvent) => {
      if (!actionsRef.current?.contains(event.target as Node)) {
        setIsMenuOpen(false);
        setIsRenameOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsMenuOpen(false);
        setIsRenameOpen(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isMenuOpen, isRenameOpen]);

  useEffect(() => {
    if (!isRenameOpen) {
      return;
    }

    setRenameValue(folder.name);
    window.setTimeout(() => {
      renameInputRef.current?.focus();
      renameInputRef.current?.select();
    }, 0);
  }, [folder.name, isRenameOpen]);

  const handleRenameSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isRenaming) {
      return;
    }

    const renamed = await onRenameFolder(renameValue);
    if (renamed) {
      setIsMenuOpen(false);
      setIsRenameOpen(false);
    }
  };

  return (
    <div className={`${styles.folderRowWrap} ${isActive ? styles.folderRowWrapActive : ""}`}>
      <button
        type="button"
        className={styles.folderExpandButton}
        onClick={onToggleExpand}
        aria-label={`${isExpanded ? "Collapse" : "Expand"} folder ${folder.name}`}
        aria-expanded={isExpanded}
      >
        {isExpanded ? "▾" : "▸"}
      </button>

      <button
        type="button"
        className={`${styles.folderRow} ${isActive ? styles.folderRowActive : ""}`}
        onClick={onSelectFolder}
        aria-current={isActive ? "true" : undefined}
      >
        <span className={styles.folderLabel}>{folder.name}</span>
        <span className={styles.folderCount}>{feedCount}</span>
      </button>

      <div className={styles.folderActions} ref={actionsRef}>
        <button
          type="button"
          className={styles.menuTrigger}
          onClick={() => setIsMenuOpen((previous) => !previous)}
          aria-label={`Open actions for folder ${folder.name}`}
          aria-haspopup="menu"
          aria-expanded={isMenuOpen || isRenameOpen}
          disabled={isDeleting || isRenaming || isRenameOpen}
        >
          ⋯
        </button>

        {isRenameOpen ? (
          <>
            {isMobile ? (
              <button
                type="button"
                className={styles.mobileSheetBackdrop}
                aria-label={`Close rename dialog for ${folder.name}`}
                onClick={() => setIsRenameOpen(false)}
              />
            ) : null}
            <div
              className={`${styles.renamePopover} ${isMobile ? styles.renamePopoverMobile : ""}`}
              role="dialog"
              aria-label={`Edit folder ${folder.name}`}
              aria-modal={isMobile ? "true" : undefined}
            >
              <form className={styles.renameForm} onSubmit={handleRenameSubmit}>
                <input
                  ref={renameInputRef}
                  type="text"
                  value={renameValue}
                  onChange={(event) => setRenameValue(event.target.value)}
                  className={styles.renameInput}
                  placeholder="Folder name"
                  maxLength={255}
                  disabled={isRenaming}
                />
                <div className={styles.renameActions}>
                  <button type="submit" className={styles.renameButton} disabled={isRenaming}>
                    {isRenaming ? "Saving..." : "Save"}
                  </button>
                  <button
                    type="button"
                    className={styles.renameButton}
                    onClick={() => setIsRenameOpen(false)}
                    disabled={isRenaming}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </>
        ) : null}

        {isMenuOpen ? (
          <div className={styles.menu} role="menu">
            <button
              type="button"
              className={styles.menuItem}
              role="menuitem"
              onClick={() => {
                setRenameValue(folder.name);
                setIsMenuOpen(false);
                setIsRenameOpen(true);
              }}
              disabled={isDeleting || isRenaming}
            >
              Edit name
            </button>
            <button
              type="button"
              className={styles.menuItem}
              role="menuitem"
              onClick={() => {
                setIsMenuOpen(false);
                onPromptDeleteFolder();
              }}
              disabled={isDeleting || isRenaming}
            >
              {isDeleting ? "Deleting..." : "Delete"}
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

/**
 * Renders folder-aware feed navigation and add-feed form.
 */
export function Sidebar({
  feeds,
  folders,
  selectedScope,
  isMobile,
  onSelectAll,
  onSelectUncategorized,
  onSelectFolder,
  onSelectFeed,
  isAddFeedFormVisible,
  feedUrlInput,
  addFeedFolderIds,
  addFeedNewFolderNameInput,
  isAddingFeed,
  isRefreshingFeeds,
  isCreatingFolder,
  onShowAddFeedForm,
  onRefresh,
  onCancelAddFeed,
  onFeedUrlChange,
  onToggleAddFeedFolder,
  onAddFeedNewFolderNameChange,
  onCreateFolderFromAddFeed,
  onSubmitFeed,
  infoMessage,
  errorMessage,
  onDismissMessage,
  deletingFeedId,
  renamingFeedId,
  updatingFeedFoldersId,
  onRequestFeedDelete,
  onRequestFeedRename,
  onRequestFeedFolderUpdate,
  deletingFolderId,
  renamingFolderId,
  onCreateFolder,
  onRequestFolderRename,
  onRequestFolderDelete,
  onCollapse,
}: SidebarProps) {
  const [expandedFolderIds, setExpandedFolderIds] = useState<Record<string, boolean>>({});
  const [isSidebarFolderFormVisible, setIsSidebarFolderFormVisible] = useState(false);
  const [sidebarFolderName, setSidebarFolderName] = useState("");
  const [pendingDeleteFolderId, setPendingDeleteFolderId] = useState<string | null>(null);
  const [isDeletingWithUnsubscribe, setIsDeletingWithUnsubscribe] = useState(false);

  useEffect(() => {
    setExpandedFolderIds((previous) => {
      const next = { ...previous };
      for (const folder of folders) {
        if (next[folder.id] === undefined) {
          next[folder.id] = true;
        }
      }
      return next;
    });
  }, [folders]);

  const sortedFolders = useMemo(
    () => [...folders].sort((a, b) => a.name.localeCompare(b.name)),
    [folders]
  );

  const sortedFeeds = useMemo(() => {
    const sorted = [...feeds];
    sorted.sort((a, b) => getFeedLabel(a).localeCompare(getFeedLabel(b)));
    return sorted;
  }, [feeds]);

  const feedsByFolderId = useMemo(() => {
    const map = new Map<string, FeedViewModel[]>();

    for (const folder of sortedFolders) {
      map.set(folder.id, []);
    }

    for (const feed of sortedFeeds) {
      for (const folderId of feed.folderIds) {
        const existing = map.get(folderId);
        if (!existing) {
          continue;
        }

        existing.push(feed);
      }
    }

    return map;
  }, [sortedFeeds, sortedFolders]);

  const uncategorizedFeeds = useMemo(
    () => sortedFeeds.filter((feed) => feed.folderIds.length === 0),
    [sortedFeeds]
  );

  const pendingDeleteStats = useMemo(() => {
    if (!pendingDeleteFolderId) {
      return null;
    }

    const folderFeeds = feedsByFolderId.get(pendingDeleteFolderId) ?? [];
    const exclusiveCount = folderFeeds.filter((feed) => feed.folderIds.length <= 1).length;
    const crossListedCount = folderFeeds.length - exclusiveCount;

    return {
      total: folderFeeds.length,
      exclusive: exclusiveCount,
      crossListed: crossListedCount,
    };
  }, [feedsByFolderId, pendingDeleteFolderId]);

  const handleCreateFolderFromSidebar = async () => {
    const nextName = sidebarFolderName.trim();
    if (!nextName || isCreatingFolder) {
      return;
    }

    const created = await onCreateFolder(nextName);
    if (created) {
      setSidebarFolderName("");
      setIsSidebarFolderFormVisible(false);
    }
  };

  const closeSidebarFolderForm = () => {
    setIsSidebarFolderFormVisible(false);
    setSidebarFolderName("");
  };

  const sidebarFolderForm = (
    <div className={styles.sidebarFolderForm}>
      <input
        type="text"
        className={styles.sidebarFolderInput}
        value={sidebarFolderName}
        onChange={(event) => setSidebarFolderName(event.currentTarget.value)}
        placeholder="Folder name"
        maxLength={255}
        disabled={isCreatingFolder}
      />
      <div className={styles.sidebarFolderActions}>
        <button
          type="button"
          className={styles.sidebarFolderButton}
          onClick={() => {
            void handleCreateFolderFromSidebar();
          }}
          disabled={isCreatingFolder}
        >
          {isCreatingFolder ? "Creating..." : "Create"}
        </button>
        <button
          type="button"
          className={styles.sidebarFolderButton}
          onClick={closeSidebarFolderForm}
          disabled={isCreatingFolder}
        >
          Cancel
        </button>
      </div>
    </div>
  );

  const renderFeedRows = (folderFeedList: FeedViewModel[]) =>
    folderFeedList.map((feed) => {
      const label = getFeedLabel(feed);
      const isActive = selectedScope.type === "feed" && selectedScope.feedId === feed.id;

      return (
        <FeedItem
          key={`${feed.id}`}
          label={label}
          isActive={isActive}
          isMobile={isMobile}
          isDeleting={deletingFeedId === feed.id}
          isRenaming={renamingFeedId === feed.id}
          isUpdatingFolders={updatingFeedFoldersId === feed.id}
          folderOptions={sortedFolders}
          selectedFolderIds={feed.folderIds}
          onSelect={() => onSelectFeed(feed.id)}
          onDelete={() => onRequestFeedDelete(feed.id)}
          onRename={(name) => onRequestFeedRename(feed.id, name)}
          onSaveFolders={(nextFolderIds) =>
            onRequestFeedFolderUpdate(feed.id, nextFolderIds)
          }
        />
      );
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
            className={`${styles.controlButton} ${
              selectedScope.type === "uncategorized" ? styles.controlButtonActive : ""
            }`}
            onClick={onSelectUncategorized}
            aria-current={selectedScope.type === "uncategorized" ? "true" : undefined}
          >
            Uncategorized
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

          <button
            type="button"
            className={styles.controlButton}
            onClick={() => setIsSidebarFolderFormVisible((previous) => !previous)}
            disabled={isCreatingFolder}
          >
            + New folder
          </button>
        </div>

        {isSidebarFolderFormVisible ? (
          isMobile ? (
            <>
              <button
                type="button"
                className={styles.mobileSheetBackdrop}
                aria-label="Close new folder dialog"
                onClick={closeSidebarFolderForm}
              />
              <div className={styles.mobileSheet} role="dialog" aria-modal="true" aria-label="Create folder">
                {sidebarFolderForm}
              </div>
            </>
          ) : (
            <div className={styles.formWrap}>{sidebarFolderForm}</div>
          )
        ) : null}

        {isAddFeedFormVisible ? (
          <div className={styles.formWrap}>
            <AddFeedForm
              feedUrlInput={feedUrlInput}
              isAddingFeed={isAddingFeed}
              availableFolders={sortedFolders}
              selectedFolderIds={addFeedFolderIds}
              newFolderNameInput={addFeedNewFolderNameInput}
              isCreatingFolder={isCreatingFolder}
              onFeedUrlChange={onFeedUrlChange}
              onToggleFolder={onToggleAddFeedFolder}
              onNewFolderNameChange={onAddFeedNewFolderNameChange}
              onCreateFolderFromForm={onCreateFolderFromAddFeed}
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
        {uncategorizedFeeds.length === 0 && sortedFolders.length === 0 && feeds.length === 0 ? (
          <p className={styles.emptyLabel}>No feeds yet.</p>
        ) : null}

        {uncategorizedFeeds.length > 0 ? (
          <div className={styles.folderSection}>
            <p className={styles.folderSectionTitle}>Uncategorized feeds</p>
            {renderFeedRows(uncategorizedFeeds)}
          </div>
        ) : null}

        {sortedFolders.length > 0 ? (
          <div className={styles.folderSection}>
            <p className={styles.folderSectionTitle}>Folders</p>
            {sortedFolders.map((folder) => {
              const folderFeeds = feedsByFolderId.get(folder.id) ?? [];
              const isExpanded = expandedFolderIds[folder.id] ?? true;
              const isFolderActive =
                selectedScope.type === "folder" && selectedScope.folderId === folder.id;

              return (
                <div key={folder.id} className={styles.folderGroup}>
                  <FolderRow
                    folder={folder}
                    isMobile={isMobile}
                    feedCount={folderFeeds.length}
                    isActive={isFolderActive}
                    isExpanded={isExpanded}
                    isDeleting={deletingFolderId === folder.id}
                    isRenaming={renamingFolderId === folder.id}
                    onToggleExpand={() =>
                      setExpandedFolderIds((previous) => ({
                        ...previous,
                        [folder.id]: !(previous[folder.id] ?? true),
                      }))
                    }
                    onSelectFolder={() => onSelectFolder(folder.id)}
                    onRenameFolder={(name) =>
                      Promise.resolve(onRequestFolderRename(folder.id, name))
                    }
                    onPromptDeleteFolder={() => {
                      setPendingDeleteFolderId(folder.id);
                      setIsDeletingWithUnsubscribe(false);
                    }}
                  />

                  {isExpanded ? (
                    <div className={styles.folderFeeds}>{renderFeedRows(folderFeeds)}</div>
                  ) : null}
                </div>
              );
            })}
          </div>
        ) : null}
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

      {pendingDeleteFolderId && pendingDeleteStats ? (
        <div className={styles.deleteDialogBackdrop}>
          <div className={styles.deleteDialog} role="dialog" aria-modal="true">
            <h3>Delete folder</h3>
            <p>
              This folder contains {pendingDeleteStats.total} feed
              {pendingDeleteStats.total === 1 ? "" : "s"}.
            </p>
            <p>
              {pendingDeleteStats.exclusive} feed
              {pendingDeleteStats.exclusive === 1 ? "" : "s"} are exclusive and{" "}
              {pendingDeleteStats.crossListed} are cross-listed in other folders.
            </p>
            <div className={styles.deleteDialogActions}>
              <button
                type="button"
                className={styles.deleteDialogButton}
                onClick={() => setPendingDeleteFolderId(null)}
                disabled={deletingFolderId === pendingDeleteFolderId}
              >
                Cancel
              </button>
              <button
                type="button"
                className={styles.deleteDialogButton}
                onClick={() => {
                  void onRequestFolderDelete(pendingDeleteFolderId, "remove_only").then(
                    (deleted) => {
                      if (deleted) {
                        setPendingDeleteFolderId(null);
                      }
                    }
                  );
                }}
                disabled={deletingFolderId === pendingDeleteFolderId}
              >
                Delete folder only
              </button>
              <button
                type="button"
                className={`${styles.deleteDialogButton} ${styles.deleteDialogButtonDanger}`}
                onClick={() => {
                  setIsDeletingWithUnsubscribe(true);
                  void onRequestFolderDelete(
                    pendingDeleteFolderId,
                    "remove_and_unsubscribe_exclusive"
                  ).then((deleted) => {
                    if (deleted) {
                      setPendingDeleteFolderId(null);
                    }
                    setIsDeletingWithUnsubscribe(false);
                  });
                }}
                disabled={deletingFolderId === pendingDeleteFolderId}
              >
                {isDeletingWithUnsubscribe
                  ? "Deleting..."
                  : "Delete folder and unsubscribe exclusive feeds"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </nav>
  );
}
