"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
  type TransitionEvent,
} from "react";
import type { FolderDeleteMode } from "@/contracts/api/folders";
import type { FeedViewModel, FolderViewModel } from "@/features/feeds/types/view-models";
import type { SidebarScope } from "@/features/feeds/types/scopes";
import type { ReadingMode } from "@/lib/shared/reading-mode";
import type { UnreadCounts } from "@/features/feeds/state/unread-counts";
import { getFeedLabel } from "@/features/feeds/state/feeds-workspace.selectors";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";
import { isReservedFolderName } from "@/lib/shared/folders";
import { BookmarkRibbonIcon } from "@/features/feeds/components/BookmarkRibbonIcon";
import { StackedLayersIcon } from "@/features/feeds/components/StackedLayersIcon";
import { EyeIcon } from "@/features/feeds/components/EyeIcon";
import primitiveStyles from "../LeftPanePrimitives.module.css";
import { PaneToggleIcon } from "../PaneToggleIcon";
import { FeedItem } from "./FeedItem";
import { readExpandedFolders, writeExpandedFolders } from "./expandedFoldersStorage";
import { FolderIcon, FolderRowIcon, TrashIcon } from "./icons";
import styles from "./Sidebar.module.css";

interface FolderTreeProps {
  feeds: FeedViewModel[];
  folders: FolderViewModel[];
  selectedScope: SidebarScope;
  isMobile: boolean;
  /** Current reading mode — controls whether unread badges/scope row are shown. */
  readingMode: ReadingMode;
  /** Unread counts per feed/folder — null in reader mode. */
  unreadCounts: UnreadCounts | null;
  onSelectAll: () => void;
  /** Select the "Unread" virtual scope (checker mode only). */
  onSelectUnread: () => void;
  onSelectSaved: () => void;
  onSelectUncategorized: () => void;
  onSelectFolder: (folderId: string) => void;
  onSelectFeed: (feedId: string) => void;

  deletingFeedId: string | null;
  renamingFeedId: string | null;
  updatingFeedFoldersId: string | null;
  onRequestFeedDelete: (feedId: string) => void;
  onRequestFeedRename: (feedId: string, name: string) => boolean | Promise<boolean>;
  onRequestFeedFolderUpdate: (
    feedId: string,
    folderIds: string[],
  ) => boolean | Promise<boolean>;

  deletingFolderId: string | null;
  renamingFolderId: string | null;
  onRequestFolderRename: (folderId: string, name: string) => boolean | Promise<boolean>;
  onRequestFolderDelete: (folderId: string, mode: FolderDeleteMode) => Promise<boolean>;

  isDeletingUncategorized: boolean;
  isMovingUncategorized: boolean;
  onRequestUncategorizedDelete: () => Promise<boolean>;
  onRequestUncategorizedMove: (folderId: string) => Promise<boolean>;

  isCreatingFolder: boolean;
  onCreateFolder: (name: string) => boolean | Promise<boolean>;
  onRequestOpenFolderForm: () => void;

  forceRenameFolderId: string | null;
  onForceRenameHandled: (folderId: string) => void;

  onCollapse: () => void;
}

interface FolderRowProps {
  folder: FolderViewModel;
  siblingFolders: FolderViewModel[];
  isMobile: boolean;
  feedCount: number;
  /** Unread article count for this folder — shown instead of feedCount in checker mode. */
  unreadCount: number | null;
  isActive: boolean;
  isExpanded: boolean;
  isDeleting: boolean;
  isRenaming: boolean;
  onToggleExpand: () => void;
  onSelectFolder: () => void;
  onRenameFolder: (name: string) => Promise<boolean>;
  onPromptDeleteFolder: () => void;
  forceRenameOpen: boolean;
  onForceRenameHandled: () => void;
}

interface ShutterFeedGroupProps {
  expanded: boolean;
  prefersReducedMotion: boolean;
  children: ReactNode;
}

function FolderRow({
  folder,
  siblingFolders,
  isMobile,
  feedCount,
  unreadCount,
  isActive,
  isExpanded,
  isDeleting,
  isRenaming,
  onToggleExpand,
  onSelectFolder,
  onRenameFolder,
  onPromptDeleteFolder,
  forceRenameOpen,
  onForceRenameHandled,
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
    if (!forceRenameOpen) {
      return;
    }

    setIsMenuOpen(false);
    setIsRenameOpen(true);
    onForceRenameHandled();
  }, [forceRenameOpen, onForceRenameHandled]);

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

  const renameNormalized = renameValue.trim().toLocaleLowerCase();
  const isRenameReserved = isReservedFolderName(renameNormalized);

  const renameDuplicateFolder =
    renameValue.trim().length > 0 && !isRenameReserved
      ? siblingFolders.find(
          (sibling) =>
            sibling.id !== folder.id &&
            sibling.name.trim().toLocaleLowerCase() === renameNormalized,
        )
      : undefined;

  const canSubmitRename =
    !isRenaming &&
    renameValue.trim().length > 0 &&
    !isRenameReserved &&
    !renameDuplicateFolder;

  const handleRenameSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canSubmitRename) {
      return;
    }

    const renamed = await onRenameFolder(renameValue);
    if (renamed) {
      setIsMenuOpen(false);
      setIsRenameOpen(false);
    }
  };

  const handleFolderRowClick = () => {
    if (isMobile) {
      onSelectFolder();
      onToggleExpand();
      return;
    }

    onSelectFolder();
    onToggleExpand();
  };

  return (
    <div
      className={`${styles.folderRowWrap} ${isActive ? styles.folderRowWrapActive : ""}`}
    >
      <button
        type="button"
        className={`${primitiveStyles.treeToggle} ${styles.folderToggle}`}
        onClick={onToggleExpand}
        aria-label={`${isExpanded ? "Collapse" : "Expand"} ${folder.name}`}
        aria-expanded={isExpanded}
      >
        <span className={styles.folderToggleContent} aria-hidden="true">
          <span className={styles.folderToggleChevron}>{isExpanded ? "▾" : "▸"}</span>
          <FolderRowIcon className={styles.folderRowIcon} />
        </span>
      </button>

      <button
        type="button"
        className={`${primitiveStyles.row} ${primitiveStyles.rowRegular} ${styles.folderRow} ${
          isActive ? primitiveStyles.rowActive : ""
        }`}
        onClick={handleFolderRowClick}
        aria-current={isActive ? "true" : undefined}
        aria-expanded={isExpanded}
      >
        <span className={styles.folderNameWrap}>
          <span className={styles.folderLabel}>{folder.name}</span>
        </span>
        <span className={`${primitiveStyles.rowCount} ${styles.rowCountAligned}`}>
          {unreadCount !== null ? unreadCount : feedCount}
        </span>
      </button>

      <div className={styles.folderActions} ref={actionsRef}>
        <button
          type="button"
          className={`${primitiveStyles.iconButton} ${styles.folderActionsButton}`}
          onClick={() => setIsMenuOpen((previous) => !previous)}
          aria-label={`Open folder actions for ${folder.name}`}
          aria-expanded={isMenuOpen}
          disabled={isDeleting || isRenaming}
        >
          ⋯
        </button>

        {isMenuOpen ? (
          <div className={primitiveStyles.menu}>
            <button
              type="button"
              className={primitiveStyles.menuItem}
              onClick={() => {
                setIsMenuOpen(false);
                setIsRenameOpen(true);
              }}
              disabled={isDeleting || isRenaming}
            >
              Rename folder
            </button>
            <button
              type="button"
              className={`${primitiveStyles.menuItem} ${primitiveStyles.menuItemDanger}`}
              onClick={() => {
                setIsMenuOpen(false);
                onPromptDeleteFolder();
              }}
              disabled={isDeleting || isRenaming}
            >
              Delete folder
            </button>
          </div>
        ) : null}
      </div>

      {isRenameOpen ? (
        <div
          className={`${primitiveStyles.dialogBackdrop} ${primitiveStyles.dialogBackdropBottom}`}
          role="presentation"
          onClick={() => setIsRenameOpen(false)}
        >
          <div
            className={`${primitiveStyles.dialog} ${primitiveStyles.dialogMobileBottom} ${styles.renameDialog}`}
            role="dialog"
            aria-modal="true"
            onClick={(event) => event.stopPropagation()}
          >
            <h3>Rename folder</h3>

            <form onSubmit={handleRenameSubmit}>
              <input
                ref={renameInputRef}
                type="text"
                className={primitiveStyles.input}
                value={renameValue}
                onChange={(event) => setRenameValue(event.currentTarget.value)}
                placeholder="Folder name"
                maxLength={255}
                disabled={isRenaming}
              />

              {isRenameReserved ? (
                <p className={styles.renameHint}>This name is reserved.</p>
              ) : renameDuplicateFolder ? (
                <p className={styles.renameHint}>
                  A folder named &quot;{renameDuplicateFolder.name}&quot; already exists.
                </p>
              ) : null}

              <div className={styles.renameDialogActions}>
                <button
                  type="button"
                  className={primitiveStyles.button}
                  onClick={() => setIsRenameOpen(false)}
                  disabled={isRenaming}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className={primitiveStyles.button}
                  disabled={!canSubmitRename}
                >
                  {isRenaming ? "Renaming..." : "Rename"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function ShutterFeedGroup({
  expanded,
  prefersReducedMotion,
  children,
}: ShutterFeedGroupProps) {
  const [isRendered, setIsRendered] = useState(expanded);
  const groupRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (expanded) {
      setIsRendered(true);
    }
  }, [expanded]);

  useEffect(() => {
    const group = groupRef.current;
    if (!group) {
      return;
    }

    if (prefersReducedMotion) {
      group.style.height = expanded ? "auto" : "0px";
      if (!expanded) {
        setIsRendered(false);
      }
      return;
    }

    if (expanded) {
      group.style.height = "0px";
      // Force a reflow so the next height assignment animates.
      void group.offsetHeight;
      group.style.height = `${group.scrollHeight}px`;
      return;
    }

    group.style.height = `${group.scrollHeight}px`;
    void group.offsetHeight;
    group.style.height = "0px";
  }, [expanded, prefersReducedMotion]);

  const handleTransitionEnd = (event: TransitionEvent<HTMLDivElement>) => {
    if (event.propertyName !== "height") {
      return;
    }

    const group = groupRef.current;
    if (!group) {
      return;
    }

    if (expanded) {
      group.style.height = "auto";
      return;
    }

    setIsRendered(false);
  };

  if (!expanded && !isRendered) {
    return null;
  }

  return (
    <div
      ref={groupRef}
      className={`${styles.folderFeedsShutter} ${styles.folderFeeds}`}
      data-expanded={expanded}
      onTransitionEnd={handleTransitionEnd}
    >
      {children}
    </div>
  );
}

export function FolderTree({
  feeds,
  folders,
  selectedScope,
  isMobile,
  readingMode,
  unreadCounts,
  onSelectAll,
  onSelectUnread,
  onSelectSaved,
  onSelectUncategorized,
  onSelectFolder,
  onSelectFeed,
  deletingFeedId,
  renamingFeedId,
  updatingFeedFoldersId,
  onRequestFeedDelete,
  onRequestFeedRename,
  onRequestFeedFolderUpdate,
  deletingFolderId,
  renamingFolderId,
  onRequestFolderRename,
  onRequestFolderDelete,
  isDeletingUncategorized,
  isMovingUncategorized,
  onRequestUncategorizedDelete,
  onRequestUncategorizedMove,
  isCreatingFolder,
  onCreateFolder,
  onRequestOpenFolderForm,
  forceRenameFolderId,
  onForceRenameHandled,
  onCollapse,
}: FolderTreeProps) {
  const prefersReducedMotion = usePrefersReducedMotion();
  const [expandedFolderIds, setExpandedFolderIds] =
    useState<Record<string, boolean>>(readExpandedFolders);
  const [isUncategorizedExpanded, setIsUncategorizedExpanded] = useState(false);
  const [isUncategorizedMenuOpen, setIsUncategorizedMenuOpen] = useState(false);
  const [isUncategorizedDeleteDialogOpen, setIsUncategorizedDeleteDialogOpen] =
    useState(false);
  const [isUncategorizedMoveDialogOpen, setIsUncategorizedMoveDialogOpen] =
    useState(false);
  const [uncategorizedTargetFolderId, setUncategorizedTargetFolderId] = useState("");
  const [uncategorizedNewFolderName, setUncategorizedNewFolderName] = useState("");
  const [
    pendingUncategorizedCreatedFolderName,
    setPendingUncategorizedCreatedFolderName,
  ] = useState<string | null>(null);
  const [pendingDeleteFeedId, setPendingDeleteFeedId] = useState<string | null>(null);
  const [pendingDeleteFolderId, setPendingDeleteFolderId] = useState<string | null>(null);
  const [deleteFolderStep, setDeleteFolderStep] = useState<"preview" | "confirm">(
    "preview",
  );
  const [selectedDeleteOption, setSelectedDeleteOption] = useState<
    "keep" | "unsubscribe" | null
  >(null);
  const [isDeletingWithUnsubscribe, setIsDeletingWithUnsubscribe] = useState(false);
  const uncategorizedActionsRef = useRef<HTMLDivElement>(null);

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
    writeExpandedFolders(expandedFolderIds);
  }, [expandedFolderIds]);

  useEffect(() => {
    if (selectedScope.type !== "feed") {
      return;
    }

    const selectedFeed = feeds.find((feed) => feed.id === selectedScope.feedId);
    if (!selectedFeed || selectedFeed.folderIds.length === 0) {
      return;
    }

    setExpandedFolderIds((previous) => {
      const next = { ...previous };
      for (const folderId of selectedFeed.folderIds) {
        next[folderId] = true;
      }
      return next;
    });
  }, [feeds, selectedScope]);

  useEffect(() => {
    if (!pendingDeleteFolderId) {
      setDeleteFolderStep("preview");
      setSelectedDeleteOption(null);
    }
  }, [pendingDeleteFolderId]);

  useEffect(() => {
    if (!isUncategorizedMenuOpen) {
      return;
    }

    const handlePointerDown = (event: MouseEvent) => {
      if (!uncategorizedActionsRef.current?.contains(event.target as Node)) {
        setIsUncategorizedMenuOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsUncategorizedMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isUncategorizedMenuOpen]);

  const sortedFolders = useMemo(() => {
    return [...folders].sort((a, b) => a.name.localeCompare(b.name));
  }, [folders]);

  const sortedFeeds = useMemo(() => {
    const sorted = [...feeds];
    sorted.sort((a, b) => getFeedLabel(a).localeCompare(getFeedLabel(b)));
    return sorted;
  }, [feeds]);

  const savedArticleCount = useMemo(() => {
    let total = 0;
    for (const feed of feeds) {
      for (const item of feed.items) {
        if (item.savedAt) {
          total += 1;
        }
      }
    }
    return total;
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

  const uncategorizedFeeds = useMemo(() => {
    return sortedFeeds.filter((feed) => feed.folderIds.length === 0);
  }, [sortedFeeds]);

  useEffect(() => {
    if (uncategorizedFeeds.length > 0) {
      return;
    }

    setIsUncategorizedMenuOpen(false);
    setIsUncategorizedDeleteDialogOpen(false);
    setIsUncategorizedMoveDialogOpen(false);
  }, [uncategorizedFeeds.length]);

  const pendingDeleteStats = useMemo(() => {
    if (!pendingDeleteFolderId) {
      return null;
    }

    const folderFeeds = feedsByFolderId.get(pendingDeleteFolderId) ?? [];
    const exclusiveCount = folderFeeds.filter(
      (feed) => feed.folderIds.length <= 1,
    ).length;
    const crossListedCount = folderFeeds.length - exclusiveCount;

    return {
      total: folderFeeds.length,
      exclusive: exclusiveCount,
      crossListed: crossListedCount,
    };
  }, [feedsByFolderId, pendingDeleteFolderId]);

  const isUncategorizedFolderReserved = isReservedFolderName(uncategorizedNewFolderName);
  const uncategorizedNewFolderDuplicate = !isUncategorizedFolderReserved
    ? folders.find(
        (folder) =>
          folder.name.trim().toLocaleLowerCase() ===
            uncategorizedNewFolderName.trim().toLocaleLowerCase() &&
          uncategorizedNewFolderName.trim().length > 0,
      )
    : undefined;

  const handleCreateFolderFromUncategorizedMove = async () => {
    const folderName = uncategorizedNewFolderName.trim();
    if (!folderName || isCreatingFolder) {
      return;
    }

    if (uncategorizedNewFolderDuplicate) {
      setUncategorizedTargetFolderId(uncategorizedNewFolderDuplicate.id);
      setUncategorizedNewFolderName("");
      return;
    }

    const created = await onCreateFolder(folderName);
    if (!created) {
      return;
    }

    setUncategorizedNewFolderName("");
    setPendingUncategorizedCreatedFolderName(folderName);
  };

  useEffect(() => {
    if (
      isUncategorizedMoveDialogOpen &&
      !uncategorizedTargetFolderId &&
      folders.length > 0
    ) {
      setUncategorizedTargetFolderId(folders[0].id);
    }
  }, [folders, isUncategorizedMoveDialogOpen, uncategorizedTargetFolderId]);

  useEffect(() => {
    if (!pendingUncategorizedCreatedFolderName) {
      return;
    }

    const createdFolder = folders.find(
      (folder) =>
        folder.name.trim().toLocaleLowerCase() ===
        pendingUncategorizedCreatedFolderName.trim().toLocaleLowerCase(),
    );
    if (!createdFolder) {
      return;
    }

    setUncategorizedTargetFolderId(createdFolder.id);
    setPendingUncategorizedCreatedFolderName(null);
  }, [folders, pendingUncategorizedCreatedFolderName]);

  const renderFeedRows = (folderFeedList: FeedViewModel[]) =>
    folderFeedList.map((feed) => {
      const label = getFeedLabel(feed);
      const isActive = selectedScope.type === "feed" && selectedScope.feedId === feed.id;
      /** Per-feed unread count — only provided in checker mode. */
      const feedUnreadCount = unreadCounts?.byFeedId.get(feed.id) ?? null;

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
          unreadCount={feedUnreadCount}
          onSelect={() => onSelectFeed(feed.id)}
          onDelete={() => setPendingDeleteFeedId(feed.id)}
          onRename={(name) => onRequestFeedRename(feed.id, name)}
          onSaveFolders={(nextFolderIds) =>
            onRequestFeedFolderUpdate(feed.id, nextFolderIds)
          }
        />
      );
    });

  return (
    <>
      <div className={styles.sections}>
        <div
          className={`${styles.folderRowWrap} ${
            selectedScope.type === "saved" ? styles.folderRowWrapActive : ""
          }`}
        >
          <button
            type="button"
            className={`${primitiveStyles.row} ${primitiveStyles.rowRegular} ${styles.folderRow} ${
              styles.allFeedsRow
            } ${selectedScope.type === "saved" ? primitiveStyles.rowActive : ""}`}
            onClick={onSelectSaved}
            aria-current={selectedScope.type === "saved" ? "true" : undefined}
          >
            <span className={styles.folderNameWrap}>
                <span className={styles.allFeedsLabelShim} aria-hidden="true">
                  <span className={styles.folderToggleChevronPlaceholder}>▸</span>
                  <BookmarkRibbonIcon
                    className={`${styles.folderRowIcon} ${styles.scopeRowIcon}`}
                  />
                </span>
              <span className={styles.folderLabel}>Saved</span>
            </span>
            <span className={`${primitiveStyles.rowCount} ${styles.rowCountAligned}`}>
              {savedArticleCount}
            </span>
          </button>
          <div className={styles.folderActionsSpacer} aria-hidden="true" />
        </div>

        {readingMode === "checker" ? (
          <div
            className={`${styles.folderRowWrap} ${
              selectedScope.type === "all" ? styles.folderRowWrapActive : ""
            }`}
          >
            <button
              type="button"
              className={`${primitiveStyles.row} ${primitiveStyles.rowRegular} ${styles.folderRow} ${
                styles.allFeedsRow
              } ${selectedScope.type === "all" ? primitiveStyles.rowActive : ""}`}
              onClick={onSelectAll}
              aria-current={selectedScope.type === "all" ? "true" : undefined}
            >
              <span className={styles.folderNameWrap}>
                <span className={styles.allFeedsLabelShim} aria-hidden="true">
                  <span className={styles.folderToggleChevronPlaceholder}>▸</span>
                  <StackedLayersIcon
                    className={`${styles.folderRowIcon} ${styles.scopeRowIcon}`}
                  />
                </span>
                <span className={styles.folderLabel}>All feeds</span>
              </span>
              <span className={`${primitiveStyles.rowCount} ${styles.rowCountAligned}`}>
                {feeds.length}
              </span>
            </button>
            <div className={styles.folderActionsSpacer} aria-hidden="true" />
          </div>
        ) : null}

        {/* "Unread" virtual scope row — only visible in checker mode. */}
        {readingMode === "checker" ? (
          <div
            className={`${styles.folderRowWrap} ${
              selectedScope.type === "unread" ? styles.folderRowWrapActive : ""
            }`}
          >
            <button
              type="button"
              className={`${primitiveStyles.row} ${primitiveStyles.rowRegular} ${styles.folderRow} ${
                styles.allFeedsRow
              } ${selectedScope.type === "unread" ? primitiveStyles.rowActive : ""}`}
              onClick={onSelectUnread}
              aria-current={selectedScope.type === "unread" ? "true" : undefined}
            >
              <span className={styles.folderNameWrap}>
                <span className={styles.allFeedsLabelShim} aria-hidden="true">
                  <span className={styles.folderToggleChevronPlaceholder}>▸</span>
                  <EyeIcon className={`${styles.folderRowIcon} ${styles.scopeRowIcon}`} />
                </span>
                <span className={styles.folderLabel}>Unread</span>
              </span>
              <span className={`${primitiveStyles.rowCount} ${styles.rowCountAligned}`}>
                {unreadCounts?.total ?? 0}
              </span>
            </button>
            <div className={styles.folderActionsSpacer} aria-hidden="true" />
          </div>
        ) : null}

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
                <span className={styles.folderToggleContent} aria-hidden="true">
                  <span className={styles.folderToggleChevron}>
                    {isUncategorizedExpanded ? "▾" : "▸"}
                  </span>
                  <FolderRowIcon className={styles.folderRowIcon} />
                </span>
              </button>
              <button
                type="button"
                className={`${primitiveStyles.row} ${primitiveStyles.rowRegular} ${styles.folderRow} ${
                  selectedScope.type === "uncategorized" ? primitiveStyles.rowActive : ""
                }`}
                onClick={() => {
                  onSelectUncategorized();
                  setIsUncategorizedExpanded((previous) => !previous);
                }}
                aria-current={selectedScope.type === "uncategorized" ? "true" : undefined}
                aria-expanded={isUncategorizedExpanded}
              >
                <span className={styles.folderNameWrap}>
                  <span className={styles.folderLabel}>Uncategorized</span>
                </span>
                <span className={`${primitiveStyles.rowCount} ${styles.rowCountAligned}`}>
                  {uncategorizedFeeds.length}
                </span>
              </button>
              <div className={styles.folderActions} ref={uncategorizedActionsRef}>
                <button
                  type="button"
                  className={`${primitiveStyles.iconButton} ${styles.folderActionsButton}`}
                  onClick={() => setIsUncategorizedMenuOpen((previous) => !previous)}
                  aria-label="Open actions for Uncategorized"
                  aria-expanded={isUncategorizedMenuOpen}
                  disabled={isDeletingUncategorized || isMovingUncategorized}
                >
                  ⋯
                </button>

                {isUncategorizedMenuOpen ? (
                  <div className={primitiveStyles.menu}>
                    <button
                      type="button"
                      className={primitiveStyles.menuItem}
                      onClick={() => {
                        setIsUncategorizedMenuOpen(false);
                        setIsUncategorizedMoveDialogOpen(true);
                      }}
                      disabled={isDeletingUncategorized || isMovingUncategorized}
                    >
                      Move all to folder...
                    </button>
                    <button
                      type="button"
                      className={primitiveStyles.menuItem}
                      onClick={() => {
                        setIsUncategorizedMenuOpen(false);
                        setIsUncategorizedDeleteDialogOpen(true);
                      }}
                      disabled={isDeletingUncategorized || isMovingUncategorized}
                    >
                      Delete uncategorized feeds
                    </button>
                  </div>
                ) : null}
              </div>
            </div>

            <ShutterFeedGroup
              expanded={isUncategorizedExpanded}
              prefersReducedMotion={prefersReducedMotion}
            >
              {renderFeedRows(uncategorizedFeeds)}
            </ShutterFeedGroup>
            {sortedFolders.length === 0 ? (
              <div className={styles.uncategorizedCta}>
                <p>No folders yet. Create one to organize uncategorized feeds.</p>
                <button
                  type="button"
                  className={`${primitiveStyles.button} ${primitiveStyles.buttonCompact}`}
                  onClick={onRequestOpenFolderForm}
                >
                  Create folder
                </button>
              </div>
            ) : null}
          </div>
        ) : null}

        {sortedFolders.map((folder) => {
          const folderFeeds = feedsByFolderId.get(folder.id) ?? [];
          const isExpanded = expandedFolderIds[folder.id] ?? false;
          const isFolderActive =
            selectedScope.type === "folder" && selectedScope.folderId === folder.id;

          return (
            <div key={folder.id} className={styles.folderGroup}>
              <FolderRow
                folder={folder}
                siblingFolders={sortedFolders}
                isMobile={isMobile}
                feedCount={folderFeeds.length}
                unreadCount={unreadCounts?.byFolderId.get(folder.id) ?? null}
                isActive={isFolderActive}
                isExpanded={isExpanded}
                isDeleting={deletingFolderId === folder.id}
                isRenaming={renamingFolderId === folder.id}
                onToggleExpand={() =>
                  setExpandedFolderIds((previous) => ({
                    ...previous,
                    [folder.id]: !(previous[folder.id] ?? false),
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
                forceRenameOpen={forceRenameFolderId === folder.id}
                onForceRenameHandled={() => onForceRenameHandled(folder.id)}
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

      <div className={styles.sidebarCollapseToggle}>
        <button
          type="button"
          className={`${primitiveStyles.iconButton} ${primitiveStyles.iconButtonSurface} ${styles.paneToggleButton}`}
          onClick={onCollapse}
          aria-label="Collapse sidebar"
          title="Collapse sidebar"
        >
          <PaneToggleIcon variant="sidebar" />
        </button>
      </div>

      {pendingDeleteFeedId
        ? (() => {
            const pendingFeed = feeds.find((feed) => feed.id === pendingDeleteFeedId);
            const pendingFeedLabel = pendingFeed
              ? getFeedLabel(pendingFeed)
              : "this feed";
            return (
              <div className={primitiveStyles.dialogBackdrop}>
                <div
                  className={`${primitiveStyles.dialog} ${styles.deleteDialog}`}
                  role="dialog"
                  aria-modal="true"
                >
                  <h3>Delete feed</h3>
                  <p>
                    Are you sure you want to delete &quot;{pendingFeedLabel}&quot;? All
                    articles from this feed will be removed. This cannot be undone.
                  </p>
                  <div className={styles.deleteDialogActions}>
                    <button
                      type="button"
                      className={primitiveStyles.button}
                      onClick={() => setPendingDeleteFeedId(null)}
                      disabled={deletingFeedId === pendingDeleteFeedId}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      className={`${primitiveStyles.button} ${primitiveStyles.buttonDanger}`}
                      onClick={() => {
                        onRequestFeedDelete(pendingDeleteFeedId);
                        setPendingDeleteFeedId(null);
                      }}
                      disabled={deletingFeedId === pendingDeleteFeedId}
                    >
                      Delete feed
                    </button>
                  </div>
                </div>
              </div>
            );
          })()
        : null}

      {pendingDeleteFolderId && pendingDeleteStats ? (
        <div
          className={styles.deleteDialogBackdropFixed}
          role="presentation"
          onClick={() => setPendingDeleteFolderId(null)}
        >
          <div
            className={`${primitiveStyles.dialog} ${styles.deleteDialog} ${styles.deleteFolderDialog}`}
            role="dialog"
            aria-modal="true"
            onClick={(event) => event.stopPropagation()}
          >
            <h3>Delete folder</h3>

            {deleteFolderStep === "preview" ? (
              <div className={styles.deleteFolderDialogStep}>
                {pendingDeleteStats.total === 0 ? (
                  <p>This folder is empty. Delete it?</p>
                ) : (
                  <>
                    <p className={styles.deleteDialogSummary}>
                      This folder contains{" "}
                      <strong>
                        {pendingDeleteStats.total} feed
                        {pendingDeleteStats.total === 1 ? "" : "s"}
                      </strong>
                      .
                    </p>
                    <div className={styles.deleteDialogFeedList}>
                      {feedsByFolderId.get(pendingDeleteFolderId)?.map((feed) => {
                        const isExclusive = feed.folderIds.length <= 1;
                        return (
                          <div key={feed.id} className={styles.deleteDialogFeedItem}>
                            <span
                              className={`${styles.feedIndicator} ${
                                isExclusive
                                  ? styles.feedIndicatorExclusive
                                  : styles.feedIndicatorShared
                              }`}
                            />
                            <span className={styles.feedName}>{getFeedLabel(feed)}</span>
                            {!isExclusive ? (
                              <span className={styles.feedIndicatorLabel}>
                                also in other folders
                              </span>
                            ) : null}
                          </div>
                        );
                      })}
                    </div>
                    <p className={styles.deleteDialogHint}>
                      {pendingDeleteStats.exclusive} feed
                      {pendingDeleteStats.exclusive === 1 ? " is" : "s are"} only in this
                      folder.
                      {pendingDeleteStats.crossListed > 0
                        ? ` ${pendingDeleteStats.crossListed} feed${
                            pendingDeleteStats.crossListed === 1 ? "" : "s"
                          } appear elsewhere too.`
                        : ""}
                    </p>
                  </>
                )}
                <div className={styles.deleteFolderDialogActions}>
                  <button
                    type="button"
                    className={primitiveStyles.button}
                    onClick={() => setPendingDeleteFolderId(null)}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className={`${primitiveStyles.button} ${primitiveStyles.buttonDanger}`}
                    onClick={() => setDeleteFolderStep("confirm")}
                  >
                    Continue
                  </button>
                </div>
              </div>
            ) : (
              <div className={styles.deleteFolderDialogStep}>
                <p className={styles.deleteDialogSummary}>
                  How would you like to handle the {pendingDeleteStats.total} feed
                  {pendingDeleteStats.total === 1 ? "" : "s"} in this folder?
                </p>
                <div className={styles.deleteDialogOptionCards}>
                  <button
                    type="button"
                    className={`${styles.deleteDialogOptionCard} ${
                      selectedDeleteOption === "unsubscribe"
                        ? styles.deleteDialogOptionCardSelected
                        : ""
                    }`}
                    onClick={() => setSelectedDeleteOption("unsubscribe")}
                  >
                    <div className={styles.deleteDialogOptionIcon}>
                      <TrashIcon className={styles.buttonIcon} />
                    </div>
                    <div className={styles.deleteDialogOptionContent}>
                      <strong>Delete folder & its feeds</strong>
                      <span>
                        If a feed is also present in any other folder, it will get deleted
                        from here but will stay there.
                      </span>
                    </div>
                  </button>
                  <button
                    type="button"
                    className={`${styles.deleteDialogOptionCard} ${
                      selectedDeleteOption === "keep"
                        ? styles.deleteDialogOptionCardSelected
                        : ""
                    }`}
                    onClick={() => setSelectedDeleteOption("keep")}
                  >
                    <div className={styles.deleteDialogOptionIcon}>
                      <FolderIcon className={styles.buttonIcon} />
                    </div>
                    <div className={styles.deleteDialogOptionContent}>
                      <strong>Delete folder, keep feeds</strong>
                      <span>
                        This folder will get deleted, but its feeds will move to the
                        Uncategorized folder.
                      </span>
                    </div>
                  </button>
                </div>
                <div className={styles.deleteFolderDialogActions}>
                  <button
                    type="button"
                    className={primitiveStyles.button}
                    onClick={() => setDeleteFolderStep("preview")}
                  >
                    Back
                  </button>
                  <button
                    type="button"
                    className={`${primitiveStyles.button} ${primitiveStyles.buttonDanger}`}
                    onClick={() => {
                      if (selectedDeleteOption === "keep") {
                        void onRequestFolderDelete(
                          pendingDeleteFolderId,
                          "remove_only",
                        ).then((deleted) => {
                          if (deleted) {
                            setPendingDeleteFolderId(null);
                          }
                        });
                      } else if (selectedDeleteOption === "unsubscribe") {
                        setIsDeletingWithUnsubscribe(true);
                        void onRequestFolderDelete(
                          pendingDeleteFolderId,
                          "remove_and_unsubscribe_exclusive",
                        ).then((deleted) => {
                          if (deleted) {
                            setPendingDeleteFolderId(null);
                          }
                          setIsDeletingWithUnsubscribe(false);
                        });
                      }
                    }}
                    disabled={!selectedDeleteOption || isDeletingWithUnsubscribe}
                  >
                    {isDeletingWithUnsubscribe ? "Deleting..." : "Delete"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : null}

      {isUncategorizedDeleteDialogOpen ? (
        <div
          className={`${primitiveStyles.dialogBackdrop} ${primitiveStyles.dialogBackdropBottom}`}
        >
          <div
            className={`${primitiveStyles.dialog} ${primitiveStyles.dialogMobileBottom} ${styles.deleteDialog}`}
            role="dialog"
            aria-modal="true"
          >
            <h3>Delete uncategorized feeds</h3>
            <p>
              This will unsubscribe and remove all feeds that are currently uncategorized.
              This cannot be undone.
            </p>
            <div className={styles.deleteDialogActions}>
              <button
                type="button"
                className={primitiveStyles.button}
                onClick={() => setIsUncategorizedDeleteDialogOpen(false)}
                disabled={isDeletingUncategorized}
              >
                Cancel
              </button>
              <button
                type="button"
                className={`${primitiveStyles.button} ${primitiveStyles.buttonDanger}`}
                onClick={() => {
                  void onRequestUncategorizedDelete().then((deleted) => {
                    if (deleted) {
                      setIsUncategorizedDeleteDialogOpen(false);
                    }
                  });
                }}
                disabled={isDeletingUncategorized}
              >
                {isDeletingUncategorized ? "Deleting..." : "Yes, delete"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {isUncategorizedMoveDialogOpen ? (
        <div
          className={`${primitiveStyles.dialogBackdrop} ${primitiveStyles.dialogBackdropBottom}`}
        >
          <div
            className={`${primitiveStyles.dialog} ${primitiveStyles.dialogMobileBottom} ${styles.deleteDialog}`}
            role="dialog"
            aria-modal="true"
          >
            <h3>Move uncategorized feeds</h3>
            <p>
              Move {uncategorizedFeeds.length} uncategorized feed
              {uncategorizedFeeds.length === 1 ? "" : "s"} to a folder.
            </p>
            {sortedFolders.length === 0 ? (
              <p>No folders exist yet. Create one below to continue.</p>
            ) : null}

            {sortedFolders.length > 0 ? (
              <label className={styles.inlineField}>
                <span>Destination folder</span>
                <select
                  className={primitiveStyles.input}
                  value={uncategorizedTargetFolderId}
                  onChange={(event) =>
                    setUncategorizedTargetFolderId(event.currentTarget.value)
                  }
                  disabled={isMovingUncategorized}
                >
                  {sortedFolders.map((folder) => (
                    <option key={folder.id} value={folder.id}>
                      {folder.name}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}

            <label className={styles.inlineField}>
              <span>Create folder inline</span>
              <input
                type="text"
                className={primitiveStyles.input}
                value={uncategorizedNewFolderName}
                onChange={(event) =>
                  setUncategorizedNewFolderName(event.currentTarget.value)
                }
                onKeyDown={(event) => {
                  if (event.key !== "Enter") {
                    return;
                  }

                  event.preventDefault();
                  void handleCreateFolderFromUncategorizedMove();
                }}
                placeholder="Folder name"
                disabled={isCreatingFolder || isMovingUncategorized}
                maxLength={255}
              />
            </label>
            {isUncategorizedFolderReserved ? (
              <p className={styles.moveDialogHint}>This name is reserved.</p>
            ) : uncategorizedNewFolderDuplicate ? (
              <p className={styles.moveDialogHint}>
                A folder named &quot;{uncategorizedNewFolderDuplicate.name}&quot; already
                exists.
              </p>
            ) : (
              <p className={styles.moveDialogHint}>
                Tip: press Enter in the field above to create the folder.
              </p>
            )}

            <div className={styles.deleteDialogActions}>
              <button
                type="button"
                className={primitiveStyles.button}
                onClick={() => {
                  setIsUncategorizedMoveDialogOpen(false);
                  setUncategorizedNewFolderName("");
                }}
                disabled={isMovingUncategorized}
              >
                Cancel
              </button>
              <button
                type="button"
                className={primitiveStyles.button}
                onClick={() => {
                  if (!uncategorizedTargetFolderId) {
                    return;
                  }

                  void onRequestUncategorizedMove(uncategorizedTargetFolderId).then(
                    (moved) => {
                      if (moved) {
                        setIsUncategorizedMoveDialogOpen(false);
                        setUncategorizedNewFolderName("");
                      }
                    },
                  );
                }}
                disabled={!uncategorizedTargetFolderId || isMovingUncategorized}
              >
                {isMovingUncategorized
                  ? "Moving..."
                  : `Move ${uncategorizedFeeds.length} feed${uncategorizedFeeds.length === 1 ? "" : "s"}`}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
