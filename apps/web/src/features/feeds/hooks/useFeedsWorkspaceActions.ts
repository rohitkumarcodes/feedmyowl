"use client";

import type {
  ArticleViewModel,
  FeedViewModel,
  FolderViewModel,
} from "@/features/feeds/types/view-models";
import type { SidebarScope } from "@/features/feeds/types/scopes";
import type { FeedsWorkspaceMobileView } from "@/features/feeds/hooks/useFeedsWorkspaceMobile";
import { useAddFeedFlow } from "@/features/feeds/hooks/useAddFeedFlow";
import { useFeedActionStatus } from "@/features/feeds/hooks/useFeedActionStatus";
import { useFeedCrudActions } from "@/features/feeds/hooks/useFeedCrudActions";
import { useFolderCrudActions } from "@/features/feeds/hooks/useFolderCrudActions";
import { useUncategorizedActions } from "@/features/feeds/hooks/useUncategorizedActions";

export type { AddFeedStage } from "@/features/feeds/hooks/useAddFeedFlow";

interface UseFeedsWorkspaceActionsOptions {
  allArticles: ArticleViewModel[];
  feeds: FeedViewModel[];
  folders: FolderViewModel[];
  isMobile: boolean;
  router: {
    refresh(): void;
  };
  setLiveMessage: React.Dispatch<React.SetStateAction<string>>;
  setFeeds: React.Dispatch<React.SetStateAction<FeedViewModel[]>>;
  setFolders: React.Dispatch<React.SetStateAction<FolderViewModel[]>>;
  setSelectedScope: React.Dispatch<React.SetStateAction<SidebarScope>>;
  setMobileViewWithHistory: (
    nextView: FeedsWorkspaceMobileView,
    shouldPush?: boolean,
  ) => void;
  setNetworkMessage: React.Dispatch<React.SetStateAction<string | null>>;
}

/**
 * Async workspace actions and inline feedback state.
 */
export function useFeedsWorkspaceActions({
  allArticles,
  feeds,
  folders,
  isMobile,
  router,
  setLiveMessage,
  setFeeds,
  setFolders,
  setSelectedScope,
  setMobileViewWithHistory,
  setNetworkMessage,
}: UseFeedsWorkspaceActionsOptions) {
  const status = useFeedActionStatus();

  const folderActions = useFolderCrudActions({
    router,
    setFeeds,
    setFolders,
    setSelectedScope,
    setInfoMessage: status.setInfoMessage,
    setErrorMessage: status.setErrorMessage,
    setShowAddAnotherAction: status.setShowAddAnotherAction,
  });

  const feedActions = useFeedCrudActions({
    allArticles,
    router,
    setFeeds,
    setSelectedScope,
    setLiveMessage,
    setNetworkMessage,
    setInfoMessage: status.setInfoMessage,
    setErrorMessage: status.setErrorMessage,
    setShowAddAnotherAction: status.setShowAddAnotherAction,
  });

  const uncategorizedActions = useUncategorizedActions({
    router,
    setFeeds,
    setSelectedScope,
    setInfoMessage: status.setInfoMessage,
    setErrorMessage: status.setErrorMessage,
    setShowAddAnotherAction: status.setShowAddAnotherAction,
    deletingFolderId: folderActions.deletingFolderId,
    renamingFolderId: folderActions.renamingFolderId,
    isCreatingFolder: folderActions.isCreatingFolder,
  });

  const addFeedFlow = useAddFeedFlow({
    feeds,
    folders,
    isMobile,
    router,
    setFeeds,
    setSelectedScope,
    setMobileViewWithHistory,
    setNetworkMessage,
    clearStatusMessages: status.clearStatusMessages,
    progressNotice: status.progressNotice,
    setProgressNotice: status.setProgressNotice,
    clearProgressNotice: status.clearProgressNotice,
    setInfoMessage: status.setInfoMessage,
    setErrorMessage: status.setErrorMessage,
    setShowAddAnotherAction: status.setShowAddAnotherAction,
    createFolder: folderActions.createFolder,
    handleRenameFolder: folderActions.handleRenameFolder,
  });

  return {
    ...addFeedFlow,

    addFeedProgressMessage: status.progressNotice,
    showAddAnotherAction: status.showAddAnotherAction,

    isCreatingFolder: folderActions.isCreatingFolder,
    deletingFolderId: folderActions.deletingFolderId,
    renamingFolderId: folderActions.renamingFolderId,
    createFolderFromSidebar: folderActions.createFolderFromSidebar,
    handleRenameFolder: folderActions.handleRenameFolder,
    handleDeleteFolder: folderActions.handleDeleteFolder,

    ...feedActions,
    ...uncategorizedActions,

    infoMessage: status.infoMessage,
    errorMessage: status.errorMessage,
    queuedNotices: status.queuedNotices,
    dismissNotice: status.dismissNotice,
    clearStatusMessages: status.clearStatusMessages,
  };
}
