/**
 * Left sidebar showing global scopes, folder tree, and feed actions.
 */

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
  type TransitionEvent,
} from "react";
import { AddFeedForm } from "./AddFeedForm";
import { FeedItem } from "./FeedItem";
import type { FeedViewModel, FolderViewModel } from "./feeds-types";
import { getFeedLabel } from "./feeds-workspace.selectors";
import type { SidebarNotice } from "./sidebar-messages";
import primitiveStyles from "./LeftPanePrimitives.module.css";
import { PaneToggleIcon } from "./PaneToggleIcon";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";
import styles from "./Sidebar.module.css";

export type SidebarScope =
  | { type: "none" }
  | { type: "all" }
  | { type: "uncategorized" }
  | { type: "folder"; folderId: string }
  | { type: "feed"; feedId: string };

type FolderDeleteMode = "remove_only" | "remove_and_unsubscribe_exclusive";
type AddFeedStage = "normalizing" | "discovering" | "awaiting_selection" | "creating";

interface SidebarDiscoveryCandidate {
  url: string;
  title: string | null;
  method: "direct" | "html_alternate" | "heuristic_path";
  duplicate: boolean;
  existingFeedId: string | null;
}

interface SidebarBulkAddResultRow {
  url: string;
  status: "imported" | "merged" | "duplicate" | "failed";
  message?: string;
}

interface SidebarBulkAddSummary {
  processedCount: number;
  importedCount: number;
  mergedCount: number;
  duplicateUnchangedCount: number;
  failedCount: number;
  failedDetails: string[];
}

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
  addFeedInputMode: "single" | "bulk";
  addFeedStage: AddFeedStage | null;
  feedUrlInput: string;
  bulkFeedUrlInput: string;
  inlineDuplicateMessage: string | null;
  addFeedFolderIds: string[];
  addFeedNewFolderNameInput: string;
  discoveryCandidates: SidebarDiscoveryCandidate[];
  selectedDiscoveryCandidateUrl: string;
  bulkAddResultRows: SidebarBulkAddResultRow[] | null;
  bulkAddSummary: SidebarBulkAddSummary | null;
  isAddingFeed: boolean;
  isRefreshingFeeds: boolean;
  isCreatingFolder: boolean;
  onShowAddFeedForm: () => void;
  onRefresh: () => void;
  onCancelAddFeed: () => void;
  onAddFeedInputModeChange: (mode: "single" | "bulk") => void;
  onFeedUrlChange: (value: string) => void;
  onBulkFeedUrlChange: (value: string) => void;
  onToggleAddFeedFolder: (folderId: string) => void;
  onAddFeedNewFolderNameChange: (value: string) => void;
  onSelectDiscoveryCandidate: (url: string) => void;
  onCreateFolderFromAddFeed: () => void;
  onSubmitFeed: (event: FormEvent<HTMLFormElement>) => void;

  notices: SidebarNotice[];
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

interface ShutterFeedGroupProps {
  expanded: boolean;
  prefersReducedMotion: boolean;
  children: ReactNode;
}

function FolderRowIcon() {
  return (
    <svg
      className={styles.folderRowIcon}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        d="M3 7.5H9L10.8 9.5H21V18.5H3V7.5Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="square"
        strokeLinejoin="miter"
      />
    </svg>
  );
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
        className={`${primitiveStyles.treeToggle} ${styles.folderToggle}`}
        onClick={onToggleExpand}
        aria-label={`${isExpanded ? "Collapse" : "Expand"} folder ${folder.name}`}
        aria-expanded={isExpanded}
      >
        {isExpanded ? "▾" : "▸"}
      </button>

      <button
        type="button"
        className={`${primitiveStyles.row} ${primitiveStyles.rowStrong} ${styles.folderRow} ${
          isActive ? primitiveStyles.rowActive : ""
        }`}
        onClick={onSelectFolder}
        aria-current={isActive ? "true" : undefined}
      >
        <span className={styles.folderNameWrap}>
          <FolderRowIcon />
          <span className={styles.folderLabel}>{folder.name}</span>
        </span>
        <span className={`${primitiveStyles.rowCount} ${styles.rowCountAligned}`}>
          {feedCount}
        </span>
      </button>

      <div className={styles.folderActions} ref={actionsRef}>
        <button
          type="button"
          className={`${primitiveStyles.iconButton} ${styles.folderActionsButton}`}
          onClick={() => setIsMenuOpen((previous) => !previous)}
          aria-label={`Open actions for folder ${folder.name}`}
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
                className={primitiveStyles.mobileBackdrop}
                aria-label={`Close rename dialog for ${folder.name}`}
                onClick={() => setIsRenameOpen(false)}
              />
            ) : null}
            <div
              className={`${primitiveStyles.popover} ${
                isMobile ? primitiveStyles.mobileSheet : primitiveStyles.popoverAnchored
              }`}
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
                  className={primitiveStyles.input}
                  placeholder="Folder name"
                  maxLength={255}
                  disabled={isRenaming}
                />
                <div className={styles.renameActions}>
                  <button
                    type="submit"
                    className={`${primitiveStyles.button} ${primitiveStyles.buttonCompact}`}
                    disabled={isRenaming}
                  >
                    {isRenaming ? "Saving..." : "Save"}
                  </button>
                  <button
                    type="button"
                    className={`${primitiveStyles.button} ${primitiveStyles.buttonCompact}`}
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
          <div className={primitiveStyles.menu}>
            <button
              type="button"
              className={primitiveStyles.menuItem}
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
              className={primitiveStyles.menuItem}
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

function ShutterFeedGroup({
  expanded,
  prefersReducedMotion,
  children,
}: ShutterFeedGroupProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const animationFrameRef = useRef<number | null>(null);
  const [isRendered, setIsRendered] = useState(expanded);
  const [heightPx, setHeightPx] = useState<string>(expanded ? "auto" : "0px");

  useEffect(() => {
    return () => {
      if (animationFrameRef.current !== null) {
        window.cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (animationFrameRef.current !== null) {
      window.cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    if (prefersReducedMotion) {
      if (expanded) {
        setIsRendered(true);
        setHeightPx("auto");
      } else {
        setHeightPx("0px");
        setIsRendered(false);
      }
      return;
    }

    if (expanded && !isRendered) {
      setIsRendered(true);
      setHeightPx("0px");
      return;
    }

    if (!isRendered) {
      return;
    }

    const container = containerRef.current;
    const content = contentRef.current;
    if (!container || !content) {
      return;
    }

    const startHeight = container.getBoundingClientRect().height;
    const endHeight = expanded ? content.scrollHeight : 0;

    if (expanded && startHeight === endHeight) {
      setHeightPx("auto");
      return;
    }

    if (!expanded && startHeight === 0) {
      setHeightPx("0px");
      setIsRendered(false);
      return;
    }

    setHeightPx(`${startHeight}px`);
    animationFrameRef.current = window.requestAnimationFrame(() => {
      setHeightPx(`${endHeight}px`);
      animationFrameRef.current = null;
    });
  }, [expanded, isRendered, prefersReducedMotion]);

  const handleTransitionEnd = (event: TransitionEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget || event.propertyName !== "height") {
      return;
    }

    if (expanded) {
      setHeightPx("auto");
      return;
    }

    setHeightPx("0px");
    setIsRendered(false);
  };

  const isFullyExpanded = expanded && isRendered && heightPx === "auto";

  return (
    <div
      ref={containerRef}
      className={styles.folderFeedsShutter}
      style={{
        height: isRendered ? heightPx : "0px",
        overflow: isFullyExpanded ? "visible" : "hidden",
      }}
      onTransitionEnd={handleTransitionEnd}
      aria-hidden={!expanded}
    >
      {isRendered ? (
        <div ref={contentRef} className={styles.folderFeeds}>
          {children}
        </div>
      ) : null}
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
  addFeedInputMode,
  addFeedStage,
  feedUrlInput,
  bulkFeedUrlInput,
  inlineDuplicateMessage,
  addFeedFolderIds,
  addFeedNewFolderNameInput,
  discoveryCandidates,
  selectedDiscoveryCandidateUrl,
  bulkAddResultRows,
  bulkAddSummary,
  isAddingFeed,
  isRefreshingFeeds,
  isCreatingFolder,
  onShowAddFeedForm,
  onRefresh,
  onCancelAddFeed,
  onAddFeedInputModeChange,
  onFeedUrlChange,
  onBulkFeedUrlChange,
  onToggleAddFeedFolder,
  onAddFeedNewFolderNameChange,
  onSelectDiscoveryCandidate,
  onCreateFolderFromAddFeed,
  onSubmitFeed,
  notices,
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
  const prefersReducedMotion = usePrefersReducedMotion();
  const [expandedFolderIds, setExpandedFolderIds] = useState<Record<string, boolean>>({});
  const [isUncategorizedExpanded, setIsUncategorizedExpanded] = useState(false);
  const [isAddMenuOpen, setIsAddMenuOpen] = useState(false);
  const [isSidebarFolderFormVisible, setIsSidebarFolderFormVisible] = useState(false);
  const [sidebarFolderName, setSidebarFolderName] = useState("");
  const [pendingDeleteFolderId, setPendingDeleteFolderId] = useState<string | null>(null);
  const [isDeletingWithUnsubscribe, setIsDeletingWithUnsubscribe] = useState(false);
  const addMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setExpandedFolderIds((previous) => {
      const next = { ...previous };
      for (const folder of folders) {
        if (next[folder.id] === undefined) {
          next[folder.id] = false;
        }
      }
      return next;
    });
  }, [folders]);

  useEffect(() => {
    if (!isAddMenuOpen) {
      return;
    }

    const handlePointerDown = (event: MouseEvent) => {
      if (!addMenuRef.current?.contains(event.target as Node)) {
        setIsAddMenuOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsAddMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isAddMenuOpen]);

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

  const openAddFeedFlow = () => {
    setIsAddMenuOpen(false);
    closeSidebarFolderForm();
    onShowAddFeedForm();
  };

  const openAddFolderFlow = () => {
    setIsAddMenuOpen(false);
    onCancelAddFeed();
    setIsSidebarFolderFormVisible(true);
  };

  const isAddMenuDisabled = isAddingFeed || isCreatingFolder;
  const canCreateSidebarFolder = sidebarFolderName.trim().length > 0 && !isCreatingFolder;

  const sidebarFolderForm = (
    <form
      className={`${styles.sidebarFolderForm} ${primitiveStyles.panel}`}
      onSubmit={(event) => {
        event.preventDefault();
        if (!canCreateSidebarFolder) {
          return;
        }
        void handleCreateFolderFromSidebar();
      }}
    >
      <input
        type="text"
        className={primitiveStyles.input}
        value={sidebarFolderName}
        onChange={(event) => setSidebarFolderName(event.currentTarget.value)}
        placeholder="Folder name"
        maxLength={255}
        disabled={isCreatingFolder}
      />
      <div className={styles.sidebarFolderActions}>
        <button
          type="submit"
          className={`${primitiveStyles.button} ${primitiveStyles.buttonCompact}`}
          disabled={!canCreateSidebarFolder}
        >
          {isCreatingFolder ? "Creating folder..." : "Create folder"}
        </button>
        <button
          type="button"
          className={`${primitiveStyles.button} ${primitiveStyles.buttonCompact}`}
          onClick={closeSidebarFolderForm}
          disabled={isCreatingFolder}
        >
          Cancel
        </button>
      </div>
    </form>
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

  const noticeKindClassNames: Record<SidebarNotice["kind"], string> = {
    error: styles.sidebarMessageError,
    progress: styles.sidebarMessageProgress,
    offline: styles.sidebarMessageOffline,
    info: styles.sidebarMessageInfo,
  };

  return (
    <div className={`${styles.root} ${primitiveStyles.tokenScope}`}>
      <div className={styles.top}>
        {/* Compact horizontal toolbar: refresh and add actions */}
        <div className={styles.toolbar}>
          <button
            type="button"
            className={`${primitiveStyles.toolbarButton} ${primitiveStyles.toolbarButtonPrimary}`}
            onClick={onRefresh}
            disabled={isRefreshingFeeds}
            aria-label={isRefreshingFeeds ? "Refreshing feeds" : "Refresh feeds"}
            title={isRefreshingFeeds ? "Refreshing feeds" : "Refresh feeds"}
          >
            <svg
              className={`${styles.toolbarIcon} ${styles.toolbarIconRefresh} ${
                isRefreshingFeeds ? styles.toolbarIconSpinning : ""
              }`}
              width="10"
              height="10"
              viewBox="0 0 16 16"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              aria-hidden="true"
            >
              <path d="M13.65 2.35A7.96 7.96 0 0 0 8 0C3.58 0 .01 3.58.01 8S3.58 16 8 16c3.73 0 6.84-2.55 7.73-6h-2.08A5.99 5.99 0 0 1 8 14 6 6 0 1 1 8 2c1.66 0 3.14.69 4.22 1.78L9 7h7V0l-2.35 2.35z" fill="currentColor"/>
            </svg>
            <span>Refresh</span>
          </button>

          <div className={styles.toolbarAction} ref={addMenuRef}>
            <button
              type="button"
              className={`${primitiveStyles.toolbarButton} ${primitiveStyles.toolbarButtonSecondary}`}
              onClick={() => setIsAddMenuOpen((previous) => !previous)}
              aria-label="Add feed or folder"
              aria-expanded={isAddMenuOpen}
              disabled={isAddMenuDisabled}
            >
              <svg
                className={styles.toolbarIcon}
                width="14"
                height="14"
                viewBox="0 0 16 16"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                aria-hidden="true"
              >
                <path
                  d="M7.25 2a.75.75 0 0 1 1.5 0v5.25H14a.75.75 0 0 1 0 1.5H8.75V14a.75.75 0 0 1-1.5 0V8.75H2a.75.75 0 0 1 0-1.5h5.25V2z"
                  fill="currentColor"
                />
              </svg>
              <span>Add feed/folder</span>
            </button>

            {isAddMenuOpen ? (
              isMobile ? (
                <>
                  <button
                    type="button"
                    className={primitiveStyles.mobileBackdrop}
                    aria-label="Close add menu"
                    onClick={() => setIsAddMenuOpen(false)}
                  />
                  <div
                    className={primitiveStyles.mobileSheet}
                    role="dialog"
                    aria-modal="true"
                    aria-label="Add feed or folder"
                  >
                    <div className={styles.addMenuMobile}>
                      <button
                        type="button"
                        className={primitiveStyles.menuItem}
                        onClick={openAddFeedFlow}
                        disabled={isAddMenuDisabled}
                      >
                        Add feed
                      </button>
                      <button
                        type="button"
                        className={primitiveStyles.menuItem}
                        onClick={openAddFolderFlow}
                        disabled={isAddMenuDisabled}
                      >
                        Add folder
                      </button>
                    </div>
                  </div>
                </>
              ) : (
                <div className={primitiveStyles.menu}>
                  <button
                    type="button"
                    className={primitiveStyles.menuItem}
                    onClick={openAddFeedFlow}
                    disabled={isAddMenuDisabled}
                  >
                    Add feed
                  </button>
                  <button
                    type="button"
                    className={primitiveStyles.menuItem}
                    onClick={openAddFolderFlow}
                    disabled={isAddMenuDisabled}
                  >
                    Add folder
                  </button>
                </div>
              )
            ) : null}
          </div>
        </div>

        {isSidebarFolderFormVisible ? (
          isMobile ? (
            <>
              <button
                type="button"
                className={primitiveStyles.mobileBackdrop}
                aria-label="Close new folder dialog"
                onClick={closeSidebarFolderForm}
              />
              <div
                className={primitiveStyles.mobileSheet}
                role="dialog"
                aria-modal="true"
                aria-label="Create folder"
              >
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
              addFeedInputMode={addFeedInputMode}
              addFeedStage={addFeedStage}
              discoveryCandidates={discoveryCandidates}
              selectedDiscoveryCandidateUrl={selectedDiscoveryCandidateUrl}
              bulkFeedUrlInput={bulkFeedUrlInput}
              inlineDuplicateMessage={inlineDuplicateMessage}
              bulkAddResultRows={bulkAddResultRows}
              bulkAddSummary={bulkAddSummary}
              feedUrlInput={feedUrlInput}
              isAddingFeed={isAddingFeed}
              availableFolders={sortedFolders}
              selectedFolderIds={addFeedFolderIds}
              newFolderNameInput={addFeedNewFolderNameInput}
              isCreatingFolder={isCreatingFolder}
              onAddFeedInputModeChange={onAddFeedInputModeChange}
              onFeedUrlChange={onFeedUrlChange}
              onBulkFeedUrlChange={onBulkFeedUrlChange}
              onToggleFolder={onToggleAddFeedFolder}
              onNewFolderNameChange={onAddFeedNewFolderNameChange}
              onSelectDiscoveryCandidate={onSelectDiscoveryCandidate}
              onCreateFolderFromForm={onCreateFolderFromAddFeed}
              onSubmitFeed={onSubmitFeed}
              onCancelAddFeed={onCancelAddFeed}
            />
          </div>
        ) : null}

        {notices.map((notice) => (
          <div
            key={notice.id}
            className={`${styles.sidebarMessage} ${noticeKindClassNames[notice.kind]}`}
            role={notice.role}
            aria-live={notice.ariaLive}
          >
            <span className={styles.sidebarMessageText}>{notice.text}</span>
            {notice.action ? (
              <button
                type="button"
                className={styles.sidebarMessageAction}
                onClick={notice.action.onAction}
              >
                {notice.action.label}
              </button>
            ) : null}
            {notice.dismissible ? (
              <button
                type="button"
                className={styles.sidebarMessageDismiss}
                onClick={onDismissMessage}
                aria-label={`Dismiss ${notice.kind} message`}
              >
                x
              </button>
            ) : null}
          </div>
        ))}
      </div>

      {/* Unified feed tree: All feeds → uncategorized → user folders */}
      <div className={styles.sections}>
        {/* "All feeds" scope — always first, always visible */}
        <div
          className={`${styles.folderRowWrap} ${
            selectedScope.type === "all" ? styles.folderRowWrapActive : ""
          }`}
        >
          <div className={styles.folderToggleSpacer} aria-hidden="true" />
          <button
            type="button"
            className={`${primitiveStyles.row} ${primitiveStyles.rowStrong} ${styles.folderRow} ${
              selectedScope.type === "all" ? primitiveStyles.rowActive : ""
            }`}
            onClick={onSelectAll}
            aria-current={selectedScope.type === "all" ? "true" : undefined}
          >
            <span className={styles.folderNameWrap}>
              <span className={styles.folderIconSpacer} aria-hidden="true">
                <FolderRowIcon />
              </span>
              <span className={styles.folderLabel}>All feeds</span>
            </span>
            <span className={`${primitiveStyles.rowCount} ${styles.rowCountAligned}`}>
              {feeds.length}
            </span>
          </button>
          <div className={styles.folderActionsSpacer} aria-hidden="true" />
        </div>

        {/* Uncategorized feeds — directly after All feeds, only when present */}
        {uncategorizedFeeds.length > 0 ? (
          <div className={styles.folderGroup}>
            <div
              className={`${styles.folderRowWrap} ${
                selectedScope.type === "uncategorized" ? styles.folderRowWrapActive : ""
              }`}
            >
              <button
                type="button"
                className={`${primitiveStyles.treeToggle} ${styles.folderToggle}`}
                onClick={() => setIsUncategorizedExpanded((previous) => !previous)}
                aria-label={`${isUncategorizedExpanded ? "Collapse" : "Expand"} Uncategorized`}
                aria-expanded={isUncategorizedExpanded}
              >
                {isUncategorizedExpanded ? "▾" : "▸"}
              </button>
              <button
                type="button"
                className={`${primitiveStyles.row} ${primitiveStyles.rowStrong} ${styles.folderRow} ${
                  selectedScope.type === "uncategorized" ? primitiveStyles.rowActive : ""
                }`}
                onClick={onSelectUncategorized}
                aria-current={selectedScope.type === "uncategorized" ? "true" : undefined}
              >
                <span className={styles.folderNameWrap}>
                  <FolderRowIcon />
                  <span className={styles.folderLabel}>Uncategorized</span>
                </span>
                <span className={`${primitiveStyles.rowCount} ${styles.rowCountAligned}`}>
                  {uncategorizedFeeds.length}
                </span>
              </button>
              <div className={styles.folderActionsSpacer} aria-hidden="true" />
            </div>

            <ShutterFeedGroup
              expanded={isUncategorizedExpanded}
              prefersReducedMotion={prefersReducedMotion}
            >
              {renderFeedRows(uncategorizedFeeds)}
            </ShutterFeedGroup>
          </div>
        ) : null}

        {/* User-created folders — after global scopes, each with nested feeds */}
        {sortedFolders.map((folder) => {
          const folderFeeds = feedsByFolderId.get(folder.id) ?? [];
          const isExpanded = expandedFolderIds[folder.id] ?? false;
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

              <ShutterFeedGroup
                expanded={isExpanded}
                prefersReducedMotion={prefersReducedMotion}
              >
                {renderFeedRows(folderFeeds)}
              </ShutterFeedGroup>
            </div>
          );
        })}

        {feeds.length === 0 && sortedFolders.length === 0 ? (
          <p className={styles.emptyLabel}>No feeds yet.</p>
        ) : null}
      </div>

      <div className={styles.collapseBar}>
        <button
          type="button"
          className={`${primitiveStyles.iconButton} ${styles.paneToggleButton}`}
          onClick={onCollapse}
          aria-label="Collapse sidebar"
          title="Collapse sidebar"
        >
          <PaneToggleIcon variant="sidebar" />
        </button>
      </div>

      {pendingDeleteFolderId && pendingDeleteStats ? (
        <div
          className={`${primitiveStyles.dialogBackdrop} ${primitiveStyles.dialogBackdropBottom}`}
        >
          <div
            className={`${primitiveStyles.dialog} ${primitiveStyles.dialogMobileBottom} ${styles.deleteDialog}`}
            role="dialog"
            aria-modal="true"
          >
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
                className={primitiveStyles.button}
                onClick={() => setPendingDeleteFolderId(null)}
                disabled={deletingFolderId === pendingDeleteFolderId}
              >
                Cancel
              </button>
              <button
                type="button"
                className={primitiveStyles.button}
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
                className={`${primitiveStyles.button} ${primitiveStyles.buttonDanger}`}
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
    </div>
  );
}
