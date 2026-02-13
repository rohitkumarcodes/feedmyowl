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
import { AddFeedDialog } from "./AddFeedDialog";
import { FeedItem } from "./FeedItem";
import type { FeedViewModel, FolderViewModel } from "./feeds-types";
import { getFeedLabel } from "./feeds-workspace.selectors";
import type { SidebarNotice } from "./sidebar-messages";
import primitiveStyles from "./LeftPanePrimitives.module.css";
import { PaneToggleIcon } from "./PaneToggleIcon";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";
import styles from "./Sidebar.module.css";

/**
 * Folder names that match built-in sidebar scope labels (case-insensitive).
 * Must stay in sync with RESERVED_FOLDER_NAMES in folder-service.ts.
 */
const RESERVED_FOLDER_NAMES = new Set(["all feeds", "uncategorized"]);

const folderIcon = (
  <svg
    className={styles.buttonIcon}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
  >
    <path
      d="M3 7V17C3 18.1 3.9 19 5 19H19C20.1 19 21 18.1 21 17V9C21 7.9 20.1 7 19 7H11L9 5H5C3.9 5 3 5.9 3 7Z"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const trashIcon = (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    className={styles.buttonIcon}
    aria-hidden="true"
  >
    <path d="M12 0c-4.992 0-10 1.242-10 3.144 0 .406 3.556 18.488 3.633 18.887 1.135 1.313 3.735 1.969 6.334 1.969 2.601 0 5.199-.656 6.335-1.969.081-.404 3.698-18.468 3.698-18.882 0-2.473-7.338-3.149-10-3.149zm0 1.86c4.211 0 7.624.746 7.624 1.667 0 .92-3.413 1.667-7.624 1.667s-7.625-.746-7.625-1.667 3.415-1.667 7.625-1.667zm4.469 19.139c-.777.532-2.418 1.001-4.502 1.001-2.081 0-3.72-.467-4.498-.998l-.004-.021c-1.552-7.913-2.414-12.369-2.894-14.882 3.55 1.456 11.304 1.455 14.849-.002-.868 4.471-2.434 12.322-2.951 14.902z" />
  </svg>
);

const EXPANDED_FOLDERS_STORAGE_KEY = "feedmyowl:expandedFolders";

/**
 * Read persisted folder expansion state from localStorage.
 * Returns an empty object if nothing is stored or parsing fails.
 */
function readExpandedFolders(): Record<string, boolean> {
  try {
    const raw = localStorage.getItem(EXPANDED_FOLDERS_STORAGE_KEY);
    if (!raw) {
      return {};
    }
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)) {
      return parsed as Record<string, boolean>;
    }
    return {};
  } catch {
    return {};
  }
}

/**
 * Persist folder expansion state to localStorage.
 */
function writeExpandedFolders(state: Record<string, boolean>): void {
  try {
    localStorage.setItem(EXPANDED_FOLDERS_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Storage full or unavailable — ignore silently.
  }
}

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
  addFeedStage: AddFeedStage | null;
  feedUrlInput: string;
  inlineDuplicateMessage: string | null;
  addFeedFolderIds: string[];
  addFeedNewFolderNameInput: string;
  discoveryCandidates: SidebarDiscoveryCandidate[];
  selectedDiscoveryCandidateUrl: string;
  createdFolderRenameId: string | null;
  isAddingFeed: boolean;
  isRefreshingFeeds: boolean;
  isCreatingFolder: boolean;
  onShowAddFeedForm: () => void;
  onRefresh: () => void;
  onCancelAddFeed: () => void;
  onFeedUrlChange: (value: string) => void;
  onToggleAddFeedFolder: (folderId: string) => void;
  onAddFeedNewFolderNameChange: (value: string) => void;
  onSelectDiscoveryCandidate: (url: string) => void;
  onCreateFolderFromAddFeed: () => void;
  onRenameFolderFromAddFeed: (
    folderId: string,
    name: string
  ) => boolean | Promise<boolean>;
  onDismissCreatedFolderRename: () => void;
  onSetAddFeedFolders: (folderIds: string[]) => void;
  onOpenExistingFeed: (url: string) => void;
  onSubmitFeed: (event: FormEvent<HTMLFormElement>) => void;

  notices: SidebarNotice[];
  onDismissMessage: (id: string) => void;

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
  isDeletingUncategorized: boolean;
  isMovingUncategorized: boolean;
  onCreateFolder: (name: string) => boolean | Promise<boolean>;
  onRequestFolderRename: (
    folderId: string,
    name: string
  ) => boolean | Promise<boolean>;
  onRequestFolderDelete: (
    folderId: string,
    mode: FolderDeleteMode
  ) => Promise<boolean>;
  onRequestUncategorizedDelete: () => Promise<boolean>;
  onRequestUncategorizedMove: (folderId: string) => Promise<boolean>;

  onCollapse: () => void;
}

interface FolderRowProps {
  folder: FolderViewModel;
  siblingFolders: FolderViewModel[];
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
  forceRenameOpen: boolean;
  onForceRenameHandled: () => void;
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
  siblingFolders,
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
  const isRenameReserved =
    renameValue.trim().length > 0 && RESERVED_FOLDER_NAMES.has(renameNormalized);

  const renameDuplicateFolder =
    renameValue.trim().length > 0 && !isRenameReserved
      ? siblingFolders.find(
          (sibling) =>
            sibling.id !== folder.id &&
            sibling.name.trim().toLocaleLowerCase() === renameNormalized
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
                {isRenameReserved ? (
                  <p className={styles.renameDuplicateHint}>
                    This name is reserved.
                  </p>
                ) : renameDuplicateFolder ? (
                  <p className={styles.renameDuplicateHint}>
                    A folder named &quot;{renameDuplicateFolder.name}&quot; already exists.
                  </p>
                ) : null}
                <div className={styles.renameActions}>
                  <button
                    type="submit"
                    className={`${primitiveStyles.button} ${primitiveStyles.buttonCompact}`}
                    disabled={!canSubmitRename}
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
  addFeedStage,
  feedUrlInput,
  inlineDuplicateMessage,
  addFeedFolderIds,
  addFeedNewFolderNameInput,
  discoveryCandidates,
  selectedDiscoveryCandidateUrl,
  createdFolderRenameId,
  isAddingFeed,
  isRefreshingFeeds,
  isCreatingFolder,
  onShowAddFeedForm,
  onRefresh,
  onCancelAddFeed,
  onFeedUrlChange,
  onToggleAddFeedFolder,
  onAddFeedNewFolderNameChange,
  onSelectDiscoveryCandidate,
  onCreateFolderFromAddFeed,
  onRenameFolderFromAddFeed,
  onDismissCreatedFolderRename,
  onSetAddFeedFolders,
  onOpenExistingFeed,
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
  isDeletingUncategorized,
  isMovingUncategorized,
  onCreateFolder,
  onRequestFolderRename,
  onRequestFolderDelete,
  onRequestUncategorizedDelete,
  onRequestUncategorizedMove,
  onCollapse,
}: SidebarProps) {
  const prefersReducedMotion = usePrefersReducedMotion();
  const [expandedFolderIds, setExpandedFolderIds] = useState<Record<string, boolean>>(
    readExpandedFolders
  );
  const [isUncategorizedExpanded, setIsUncategorizedExpanded] = useState(false);
  const [isUncategorizedMenuOpen, setIsUncategorizedMenuOpen] = useState(false);
  const [isUncategorizedDeleteDialogOpen, setIsUncategorizedDeleteDialogOpen] =
    useState(false);
  const [isUncategorizedMoveDialogOpen, setIsUncategorizedMoveDialogOpen] =
    useState(false);
  const [uncategorizedTargetFolderId, setUncategorizedTargetFolderId] = useState("");
  const [uncategorizedNewFolderName, setUncategorizedNewFolderName] = useState("");
  const [pendingUncategorizedCreatedFolderName, setPendingUncategorizedCreatedFolderName] =
    useState<string | null>(null);
  const [isAddMenuOpen, setIsAddMenuOpen] = useState(false);
  const [isSidebarFolderFormVisible, setIsSidebarFolderFormVisible] = useState(false);
  const [sidebarFolderName, setSidebarFolderName] = useState("");
  const [pendingSidebarAutoRenameFolderName, setPendingSidebarAutoRenameFolderName] =
    useState<string | null>(null);
  const [autoRenameFolderId, setAutoRenameFolderId] = useState<string | null>(null);
  const [pendingDeleteFeedId, setPendingDeleteFeedId] = useState<string | null>(null);
  const [pendingDeleteFolderId, setPendingDeleteFolderId] = useState<string | null>(null);
  const [deleteFolderStep, setDeleteFolderStep] = useState<"preview" | "confirm">("preview");
  const [selectedDeleteOption, setSelectedDeleteOption] = useState<"keep" | "unsubscribe" | null>(null);
  const [isDeletingWithUnsubscribe, setIsDeletingWithUnsubscribe] = useState(false);
  const addMenuRef = useRef<HTMLDivElement>(null);
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

  // Persist folder expansion state to localStorage whenever it changes.
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
    if (!pendingSidebarAutoRenameFolderName) {
      return;
    }

    const createdFolder = folders.find(
      (folder) =>
        folder.name.trim().toLocaleLowerCase() ===
        pendingSidebarAutoRenameFolderName.trim().toLocaleLowerCase()
    );

    if (!createdFolder) {
      return;
    }

    setAutoRenameFolderId(createdFolder.id);
    setPendingSidebarAutoRenameFolderName(null);
  }, [folders, pendingSidebarAutoRenameFolderName]);

  useEffect(() => {
    if (isUncategorizedMoveDialogOpen && !uncategorizedTargetFolderId && folders.length > 0) {
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
        pendingUncategorizedCreatedFolderName.trim().toLocaleLowerCase()
    );
    if (!createdFolder) {
      return;
    }

    setUncategorizedTargetFolderId(createdFolder.id);
    setPendingUncategorizedCreatedFolderName(null);
  }, [folders, pendingUncategorizedCreatedFolderName]);

  useEffect(() => {
    if (!pendingDeleteFolderId) {
      setDeleteFolderStep("preview");
      setSelectedDeleteOption(null);
    }
  }, [pendingDeleteFolderId]);

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
      setPendingSidebarAutoRenameFolderName(nextName);
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
  const isSidebarFolderReserved =
    sidebarFolderName.trim().length > 0 &&
    RESERVED_FOLDER_NAMES.has(sidebarFolderName.trim().toLocaleLowerCase());
  const sidebarFolderDuplicate = !isSidebarFolderReserved
    ? folders.find(
        (folder) =>
          folder.name.trim().toLocaleLowerCase() ===
          sidebarFolderName.trim().toLocaleLowerCase() &&
          sidebarFolderName.trim().length > 0
      )
    : undefined;
  const canCreateSidebarFolder =
    sidebarFolderName.trim().length > 0 &&
    !isCreatingFolder &&
    !isSidebarFolderReserved &&
    !sidebarFolderDuplicate;
  const isUncategorizedFolderReserved =
    uncategorizedNewFolderName.trim().length > 0 &&
    RESERVED_FOLDER_NAMES.has(
      uncategorizedNewFolderName.trim().toLocaleLowerCase()
    );
  const uncategorizedNewFolderDuplicate = !isUncategorizedFolderReserved
    ? folders.find(
        (folder) =>
          folder.name.trim().toLocaleLowerCase() ===
          uncategorizedNewFolderName.trim().toLocaleLowerCase() &&
          uncategorizedNewFolderName.trim().length > 0
      )
    : undefined;
  const canCreateUncategorizedFolder =
    uncategorizedNewFolderName.trim().length > 0 &&
    !uncategorizedNewFolderDuplicate &&
    !isUncategorizedFolderReserved &&
    !isCreatingFolder;

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
        autoFocus
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
      {isSidebarFolderReserved ? (
        <div className={styles.sidebarDuplicateRow}>
          <span className={styles.sidebarDuplicateText}>
            This name is reserved.
          </span>
        </div>
      ) : sidebarFolderDuplicate ? (
        <div className={styles.sidebarDuplicateRow}>
          <span className={styles.sidebarDuplicateText}>
            A folder named &quot;{sidebarFolderDuplicate.name}&quot; already exists.
          </span>
          <button
            type="button"
            className={`${primitiveStyles.button} ${primitiveStyles.buttonCompact}`}
            onClick={() => {
              closeSidebarFolderForm();
              onSelectFolder(sidebarFolderDuplicate.id);
            }}
            disabled={isCreatingFolder}
          >
            Use existing
          </button>
        </div>
      ) : null}
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
          onDelete={() => setPendingDeleteFeedId(feed.id)}
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
  const noticeKindIcons: Record<SidebarNotice["kind"], string> = {
    error: "!",
    progress: "~",
    offline: "o",
    info: "i",
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

        {notices.map((notice) => (
          <div
            key={notice.id}
            className={`${styles.sidebarMessage} ${noticeKindClassNames[notice.kind]}`}
            role={notice.role}
            aria-live={notice.ariaLive}
          >
            <span className={styles.sidebarMessageIcon} aria-hidden="true">
              {noticeKindIcons[notice.kind]}
            </span>
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
                onClick={() => onDismissMessage(notice.id)}
                aria-label={`Dismiss ${notice.kind} message`}
              >
                x
              </button>
            ) : null}
          </div>
        ))}
      </div>

      <AddFeedDialog
        open={isAddFeedFormVisible}
        addFeedStage={addFeedStage}
        discoveryCandidates={discoveryCandidates}
        selectedDiscoveryCandidateUrl={selectedDiscoveryCandidateUrl}
        inlineDuplicateMessage={inlineDuplicateMessage}
        feedUrlInput={feedUrlInput}
        isAddingFeed={isAddingFeed}
        availableFolders={sortedFolders}
        selectedFolderIds={addFeedFolderIds}
        newFolderNameInput={addFeedNewFolderNameInput}
        isCreatingFolder={isCreatingFolder}
        createdFolderRenameId={createdFolderRenameId}
        onFeedUrlChange={onFeedUrlChange}
        onToggleFolder={onToggleAddFeedFolder}
        onSetSelectedFolders={onSetAddFeedFolders}
        onNewFolderNameChange={onAddFeedNewFolderNameChange}
        onSelectDiscoveryCandidate={onSelectDiscoveryCandidate}
        onCreateFolderFromForm={onCreateFolderFromAddFeed}
        onRenameFolderFromForm={onRenameFolderFromAddFeed}
        onDismissCreatedFolderRename={onDismissCreatedFolderRename}
        onOpenExistingFeed={onOpenExistingFeed}
        onSubmitFeed={onSubmitFeed}
        onClose={onCancelAddFeed}
      />

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
                  onClick={openAddFolderFlow}
                >
                  Create folder
                </button>
              </div>
            ) : null}
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
                siblingFolders={sortedFolders}
                isMobile={isMobile}
                feedCount={folderFeeds.length}
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
                forceRenameOpen={autoRenameFolderId === folder.id}
                onForceRenameHandled={() =>
                  setAutoRenameFolderId((previous) =>
                    previous === folder.id ? null : previous
                  )
                }
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

      {pendingDeleteFeedId ? (() => {
        const pendingFeed = feeds.find((feed) => feed.id === pendingDeleteFeedId);
        const pendingFeedLabel = pendingFeed ? getFeedLabel(pendingFeed) : "this feed";
        return (
          <div
            className={`${primitiveStyles.dialogBackdrop} ${primitiveStyles.dialogBackdropBottom}`}
          >
            <div
              className={`${primitiveStyles.dialog} ${primitiveStyles.dialogMobileBottom} ${styles.deleteDialog}`}
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
      })() : null}

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
            
            {deleteFolderStep === "preview" ? (
              <>
                {pendingDeleteStats.total === 0 ? (
                  <p>This folder is empty. Delete it?</p>
                ) : (
                  <>
                    <p className={styles.deleteDialogSummary}>
                      This folder contains <strong>{pendingDeleteStats.total} feed{pendingDeleteStats.total === 1 ? "" : "s"}</strong>.
                    </p>
                    <div className={styles.deleteDialogFeedList}>
                      {feedsByFolderId.get(pendingDeleteFolderId)?.map((feed) => {
                        const isExclusive = feed.folderIds.length <= 1;
                        return (
                          <div 
                            key={feed.id} 
                            className={styles.deleteDialogFeedItem}
                          >
                            <span className={`${styles.feedIndicator} ${isExclusive ? styles.feedIndicatorExclusive : styles.feedIndicatorShared}`} />
                            <span className={styles.feedName}>{getFeedLabel(feed)}</span>
                            {!isExclusive && (
                              <span className={styles.feedIndicatorLabel}>also in other folders</span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                    <p className={styles.deleteDialogHint}>
                      {pendingDeleteStats.exclusive} feed{pendingDeleteStats.exclusive === 1 ? " is" : "s are"} only in this folder. 
                      {pendingDeleteStats.crossListed > 0 && ` ${pendingDeleteStats.crossListed} feed${pendingDeleteStats.crossListed === 1 ? "" : "s"} appear elsewhere too.`}
                    </p>
                  </>
                )}
                <div className={styles.deleteDialogActions}>
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
              </>
            ) : (
              <>
                <p className={styles.deleteDialogSummary}>
                  How would you like to handle the {pendingDeleteStats.total} feed{pendingDeleteStats.total === 1 ? "" : "s"} in this folder?
                </p>
                <div className={styles.deleteDialogOptionCards}>
                  <button
                    type="button"
                    className={`${styles.deleteDialogOptionCard} ${selectedDeleteOption === "keep" ? styles.deleteDialogOptionCardSelected : ""}`}
                    onClick={() => setSelectedDeleteOption("keep")}
                  >
                    <div className={styles.deleteDialogOptionIcon}>{folderIcon}</div>
                    <div className={styles.deleteDialogOptionContent}>
                      <strong>Keep all feeds</strong>
                      <span>Feeds will remain in your library, just without this folder</span>
                    </div>
                  </button>
                  <button
                    type="button"
                    className={`${styles.deleteDialogOptionCard} ${selectedDeleteOption === "unsubscribe" ? styles.deleteDialogOptionCardSelected : ""}`}
                    onClick={() => setSelectedDeleteOption("unsubscribe")}
                  >
                    <div className={styles.deleteDialogOptionIcon}>{trashIcon}</div>
                    <div className={styles.deleteDialogOptionContent}>
                      <strong>Remove from this folder only</strong>
                      <span>Removes folder and unsubscribes from {pendingDeleteStats.exclusive} feed{pendingDeleteStats.exclusive === 1 ? "" : "s"} that are only here</span>
                    </div>
                  </button>
                </div>
                <div className={styles.deleteDialogActions}>
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
                        void onRequestFolderDelete(pendingDeleteFolderId, "remove_only").then((deleted) => {
                          if (deleted) {
                            setPendingDeleteFolderId(null);
                          }
                        });
                      } else if (selectedDeleteOption === "unsubscribe") {
                        setIsDeletingWithUnsubscribe(true);
                        void onRequestFolderDelete(pendingDeleteFolderId, "remove_and_unsubscribe_exclusive").then((deleted) => {
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
              </>
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
                  onChange={(event) => setUncategorizedTargetFolderId(event.currentTarget.value)}
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
                onChange={(event) => setUncategorizedNewFolderName(event.currentTarget.value)}
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
              <p className={styles.moveDialogHint}>
                This name is reserved.
              </p>
            ) : uncategorizedNewFolderDuplicate ? (
              <p className={styles.moveDialogHint}>
                A folder named &quot;{uncategorizedNewFolderDuplicate.name}&quot; already exists.
              </p>
            ) : (
              <p className={styles.moveDialogHint}>
                Tip: press Enter in the field above to create the folder.
              </p>
            )}
            <div className={styles.deleteDialogActions}>
              <button
                type="button"
                className={`${primitiveStyles.button} ${primitiveStyles.buttonCompact}`}
                onClick={() => {
                  void handleCreateFolderFromUncategorizedMove();
                }}
                disabled={!canCreateUncategorizedFolder || isMovingUncategorized}
              >
                {isCreatingFolder ? "Creating..." : "Create folder"}
              </button>
              {uncategorizedNewFolderDuplicate ? (
                <button
                  type="button"
                  className={`${primitiveStyles.button} ${primitiveStyles.buttonCompact}`}
                  onClick={() => {
                    setUncategorizedTargetFolderId(uncategorizedNewFolderDuplicate.id);
                    setUncategorizedNewFolderName("");
                  }}
                  disabled={isMovingUncategorized}
                >
                  Use existing
                </button>
              ) : null}
            </div>

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

                  void onRequestUncategorizedMove(uncategorizedTargetFolderId).then((moved) => {
                    if (moved) {
                      setIsUncategorizedMoveDialogOpen(false);
                      setUncategorizedNewFolderName("");
                    }
                  });
                }}
                disabled={!uncategorizedTargetFolderId || isMovingUncategorized}
              >
                {isMovingUncategorized
                  ? "Moving..."
                  : `Move ${uncategorizedFeeds.length} feed${
                      uncategorizedFeeds.length === 1 ? "" : "s"
                    }`}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
