"use client";

import { useEffect, useState, type FormEvent } from "react";
import type {
  AddFeedStage,
  DiscoveryCandidate,
} from "@/features/feeds/hooks/useAddFeedFlow";
import type { FeedViewModel, FolderViewModel } from "@/features/feeds/types/view-models";
import type { SidebarScope } from "@/features/feeds/types/scopes";
import type { FolderDeleteMode } from "@/contracts/api/folders";
import type { SidebarNotice } from "./sidebar-messages";
import type { ReadingMode } from "@/lib/shared/reading-mode";
import type { UnreadCounts } from "@/features/feeds/state/unread-counts";
import primitiveStyles from "../LeftPanePrimitives.module.css";
import { AddFeedSection } from "./AddFeedSection";
import { FolderTree } from "./FolderTree";
import { Notices } from "./Notices";
import styles from "./Sidebar.module.css";

export type { SidebarScope };

interface SidebarProps {
  feeds: FeedViewModel[];
  folders: FolderViewModel[];
  selectedScope: SidebarScope;
  isMobile: boolean;
  /** Current reading mode — controls whether unread badges/scope are shown. */
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

  isAddFeedFormVisible: boolean;
  addFeedStage: AddFeedStage | null;
  feedUrlInput: string;
  addFeedFieldError: string | null;
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
  onOpenExistingFeed: (url: string, existingFeedId?: string | null) => void;
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
    folderIds: string[],
  ) => boolean | Promise<boolean>;

  deletingFolderId: string | null;
  renamingFolderId: string | null;
  isDeletingUncategorized: boolean;
  isMovingUncategorized: boolean;
  onCreateFolder: (name: string) => boolean | Promise<boolean>;
  onRequestFolderRename: (folderId: string, name: string) => boolean | Promise<boolean>;
  onRequestFolderDelete: (folderId: string, mode: FolderDeleteMode) => Promise<boolean>;
  onRequestUncategorizedDelete: () => Promise<boolean>;
  onRequestUncategorizedMove: (folderId: string) => Promise<boolean>;

  onCollapse: () => void;
}

/**
 * Left sidebar showing global scopes, folder tree, and feed actions.
 */
export function Sidebar({
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
  isAddFeedFormVisible,
  addFeedStage,
  feedUrlInput,
  addFeedFieldError,
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
  const [pendingAutoRenameFolderName, setPendingAutoRenameFolderName] = useState<
    string | null
  >(null);
  const [forceRenameFolderId, setForceRenameFolderId] = useState<string | null>(null);

  useEffect(() => {
    if (!pendingAutoRenameFolderName) {
      return;
    }

    const createdFolder = folders.find(
      (folder) =>
        folder.name.trim().toLocaleLowerCase() ===
        pendingAutoRenameFolderName.trim().toLocaleLowerCase(),
    );

    if (!createdFolder) {
      return;
    }

    setForceRenameFolderId(createdFolder.id);
    setPendingAutoRenameFolderName(null);
  }, [folders, pendingAutoRenameFolderName]);

  return (
    <div className={`${styles.root} ${primitiveStyles.tokenScope}`}>
      <div className={styles.top}>
        <AddFeedSection
          isMobile={isMobile}
          folders={folders}
          isAddFeedFormVisible={isAddFeedFormVisible}
          addFeedStage={addFeedStage}
          feedUrlInput={feedUrlInput}
          addFeedFieldError={addFeedFieldError}
          inlineDuplicateMessage={inlineDuplicateMessage}
          addFeedFolderIds={addFeedFolderIds}
          addFeedNewFolderNameInput={addFeedNewFolderNameInput}
          discoveryCandidates={discoveryCandidates}
          selectedDiscoveryCandidateUrl={selectedDiscoveryCandidateUrl}
          createdFolderRenameId={createdFolderRenameId}
          isAddingFeed={isAddingFeed}
          isRefreshingFeeds={isRefreshingFeeds}
          isCreatingFolder={isCreatingFolder}
          onShowAddFeedForm={onShowAddFeedForm}
          onRefresh={onRefresh}
          onCancelAddFeed={onCancelAddFeed}
          onFeedUrlChange={onFeedUrlChange}
          onToggleAddFeedFolder={onToggleAddFeedFolder}
          onAddFeedNewFolderNameChange={onAddFeedNewFolderNameChange}
          onSelectDiscoveryCandidate={onSelectDiscoveryCandidate}
          onCreateFolderFromAddFeed={onCreateFolderFromAddFeed}
          onRenameFolderFromAddFeed={onRenameFolderFromAddFeed}
          onDismissCreatedFolderRename={onDismissCreatedFolderRename}
          onOpenExistingFeed={onOpenExistingFeed}
          onSubmitFeed={onSubmitFeed}
          onCreateFolder={onCreateFolder}
          onSelectFolder={onSelectFolder}
          onRequestAutoRenameFolder={setPendingAutoRenameFolderName}
        />

        <Notices notices={notices} onDismissMessage={onDismissMessage} />
      </div>

      <FolderTree
        feeds={feeds}
        folders={folders}
        selectedScope={selectedScope}
        isMobile={isMobile}
        readingMode={readingMode}
        unreadCounts={unreadCounts}
        onSelectAll={onSelectAll}
        onSelectUnread={onSelectUnread}
        onSelectSaved={onSelectSaved}
        onSelectUncategorized={onSelectUncategorized}
        onSelectFolder={onSelectFolder}
        onSelectFeed={onSelectFeed}
        deletingFeedId={deletingFeedId}
        renamingFeedId={renamingFeedId}
        updatingFeedFoldersId={updatingFeedFoldersId}
        onRequestFeedDelete={onRequestFeedDelete}
        onRequestFeedRename={onRequestFeedRename}
        onRequestFeedFolderUpdate={onRequestFeedFolderUpdate}
        deletingFolderId={deletingFolderId}
        renamingFolderId={renamingFolderId}
        onRequestFolderRename={onRequestFolderRename}
        onRequestFolderDelete={onRequestFolderDelete}
        isDeletingUncategorized={isDeletingUncategorized}
        isMovingUncategorized={isMovingUncategorized}
        onRequestUncategorizedDelete={onRequestUncategorizedDelete}
        onRequestUncategorizedMove={onRequestUncategorizedMove}
        isCreatingFolder={isCreatingFolder}
        onCreateFolder={onCreateFolder}
        forceRenameFolderId={forceRenameFolderId}
        onForceRenameHandled={(folderId) =>
          setForceRenameFolderId((previous) => (previous === folderId ? null : previous))
        }
        onCollapse={onCollapse}
      />
    </div>
  );
}
