"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import type {
  AddFeedStage,
  DiscoveryCandidate,
} from "@/features/feeds/hooks/useAddFeedFlow";
import type { FolderViewModel } from "@/features/feeds/types/view-models";
import { isReservedFolderName } from "@/lib/shared/folders";
import primitiveStyles from "../LeftPanePrimitives.module.css";
import { AddFeedDialog } from "../AddFeedDialog";
import { PlusIcon, RefreshIcon } from "./icons";
import styles from "./Sidebar.module.css";

interface AddFeedSectionProps {
  isMobile: boolean;
  folders: FolderViewModel[];
  openFolderFormTick?: number;

  isAddFeedFormVisible: boolean;
  addFeedStage: AddFeedStage | null;
  feedUrlInput: string;
  inlineDuplicateMessage: string | null;
  addFeedFolderIds: string[];
  addFeedNewFolderNameInput: string;
  discoveryCandidates: DiscoveryCandidate[];
  selectedDiscoveryCandidateUrl: string;
  createdFolderRenameId?: string | null;
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
    name: string,
  ) => Promise<boolean> | boolean;
  onDismissCreatedFolderRename: () => void;
  onOpenExistingFeed: (url: string) => void;
  onSubmitFeed: (event: FormEvent<HTMLFormElement>) => void;

  onCreateFolder: (name: string) => boolean | Promise<boolean>;
  onSelectFolder: (folderId: string) => void;
  onRequestAutoRenameFolder: (folderName: string) => void;
}

export function AddFeedSection({
  isMobile,
  folders,
  openFolderFormTick = 0,
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
  onOpenExistingFeed,
  onSubmitFeed,
  onCreateFolder,
  onSelectFolder,
  onRequestAutoRenameFolder,
}: AddFeedSectionProps) {
  const [isAddMenuOpen, setIsAddMenuOpen] = useState(false);
  const [isSidebarFolderFormVisible, setIsSidebarFolderFormVisible] = useState(false);
  const [sidebarFolderName, setSidebarFolderName] = useState("");
  const addMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (openFolderFormTick === 0) {
      return;
    }

    setIsAddMenuOpen(false);
    onCancelAddFeed();
    setIsSidebarFolderFormVisible(true);
  }, [onCancelAddFeed, openFolderFormTick]);

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

  const sortedFolders = useMemo(() => {
    return [...folders].sort((a, b) => a.name.localeCompare(b.name));
  }, [folders]);

  const isAddMenuDisabled = isAddingFeed || isCreatingFolder;
  const isSidebarFolderReserved = isReservedFolderName(sidebarFolderName);
  const sidebarFolderDuplicate = !isSidebarFolderReserved
    ? folders.find(
        (folder) =>
          folder.name.trim().toLocaleLowerCase() ===
            sidebarFolderName.trim().toLocaleLowerCase() &&
          sidebarFolderName.trim().length > 0,
      )
    : undefined;

  const canCreateSidebarFolder =
    sidebarFolderName.trim().length > 0 &&
    !isCreatingFolder &&
    !isSidebarFolderReserved &&
    !sidebarFolderDuplicate;

  const closeSidebarFolderForm = () => {
    setIsSidebarFolderFormVisible(false);
    setSidebarFolderName("");
  };

  const handleCreateFolderFromSidebar = async () => {
    const nextName = sidebarFolderName.trim();
    if (!nextName || isCreatingFolder) {
      return;
    }

    const created = await onCreateFolder(nextName);
    if (created) {
      onRequestAutoRenameFolder(nextName);
      setSidebarFolderName("");
      setIsSidebarFolderFormVisible(false);
    }
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
          <span className={styles.sidebarDuplicateText}>This name is reserved.</span>
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

  return (
    <>
      <div className={styles.toolbar}>
        <button
          type="button"
          className={`${primitiveStyles.toolbarButton} ${primitiveStyles.toolbarButtonPrimary} ${styles.toolbarRefresh}`}
          onClick={onRefresh}
          disabled={isRefreshingFeeds}
          aria-label={isRefreshingFeeds ? "Refreshing feeds" : "Refresh feeds"}
          title={isRefreshingFeeds ? "Refreshing feeds" : "Refresh feeds"}
        >
          <RefreshIcon
            className={`${styles.toolbarIcon} ${styles.toolbarIconRefresh} ${
              isRefreshingFeeds ? styles.toolbarIconSpinning : ""
            }`}
          />
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
            <PlusIcon className={styles.toolbarIcon} />
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
                    <button
                      type="button"
                      className={`${primitiveStyles.menuItem} ${primitiveStyles.menuItemCancel}`}
                      onClick={() => setIsAddMenuOpen(false)}
                    >
                      Cancel
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
        onNewFolderNameChange={onAddFeedNewFolderNameChange}
        onSelectDiscoveryCandidate={onSelectDiscoveryCandidate}
        onCreateFolderFromForm={onCreateFolderFromAddFeed}
        onRenameFolderFromForm={onRenameFolderFromAddFeed}
        onDismissCreatedFolderRename={onDismissCreatedFolderRename}
        onOpenExistingFeed={onOpenExistingFeed}
        onSubmitFeed={onSubmitFeed}
        onClose={onCancelAddFeed}
      />
    </>
  );
}
