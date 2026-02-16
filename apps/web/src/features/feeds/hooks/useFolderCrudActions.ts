"use client";

import { useCallback, useState } from "react";
import type { FolderDeleteMode } from "@/contracts/api/folders";
import type { FeedViewModel, FolderViewModel } from "@/features/feeds/types/view-models";
import type { SidebarScope } from "@/features/feeds/types/scopes";
import type { FeedActionNoticeOptions } from "@/features/feeds/hooks/useFeedActionStatus";
import {
  createFolder as createFolderRequest,
  deleteFolder as deleteFolderRequest,
  renameFolder as renameFolderRequest,
} from "@/lib/client/folders";
import type { ApiErrorBody } from "@/contracts/api/common";
import { mapApiCallResultToUiMessage, type UiActionContext } from "@/lib/shared/ui-messages";

interface UseFolderCrudActionsOptions {
  router: { refresh(): void };
  setFeeds: React.Dispatch<React.SetStateAction<FeedViewModel[]>>;
  setFolders: React.Dispatch<React.SetStateAction<FolderViewModel[]>>;
  setSelectedScope: React.Dispatch<React.SetStateAction<SidebarScope>>;
  setInfoMessage: (message: string | null, options?: FeedActionNoticeOptions) => void;
  setErrorMessage: (message: string | null, options?: FeedActionNoticeOptions) => void;
  setShowAddAnotherAction: React.Dispatch<React.SetStateAction<boolean>>;
}

export function useFolderCrudActions({
  router,
  setFeeds,
  setFolders,
  setSelectedScope,
  setInfoMessage,
  setErrorMessage,
  setShowAddAnotherAction,
}: UseFolderCrudActionsOptions) {
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [deletingFolderId, setDeletingFolderId] = useState<string | null>(null);
  const [renamingFolderId, setRenamingFolderId] = useState<string | null>(null);

  const handleApiFailure = useCallback(
    (
      result: {
        status: number;
        networkError: boolean;
        body: Partial<ApiErrorBody> | null;
        headers: Headers | null;
      },
      context: UiActionContext,
      fallbackMessage: string,
      retryAction?: () => void,
    ) => {
      const mapped = mapApiCallResultToUiMessage(result, context, fallbackMessage);
      setErrorMessage(mapped.text, {
        severity: mapped.severity,
        title: mapped.title,
        dedupeKey: mapped.dedupeKey,
        source: "folder",
        retryAction:
          retryAction && mapped.recommendedActionLabel === "Retry"
            ? {
                label: "Retry",
                onAction: retryAction,
              }
            : undefined,
      });
    },
    [setErrorMessage],
  );

  const createFolder = useCallback(
    async (name: string): Promise<FolderViewModel | null> => {
      const trimmedName = name.trim();

      if (!trimmedName || isCreatingFolder) {
        return null;
      }

      setIsCreatingFolder(true);
      setInfoMessage(null);
      setErrorMessage(null);
      setShowAddAnotherAction(false);

      const result = await createFolderRequest(trimmedName);
      const body = result.body;
      if (!result.ok || !body?.folder?.id) {
        handleApiFailure(result, "folder.create", "Couldn't create this folder. Try again.", () => {
          void createFolder(trimmedName);
        });
        setIsCreatingFolder(false);
        return null;
      }

      const nextFolder: FolderViewModel = {
        id: body.folder.id,
        name: body.folder.name,
        createdAt: body.folder.createdAt ?? new Date().toISOString(),
        updatedAt: body.folder.updatedAt ?? new Date().toISOString(),
      };

      setFolders((previousFolders) => {
        const exists = previousFolders.some((folder) => folder.id === nextFolder.id);
        if (exists) {
          return previousFolders;
        }

        return [...previousFolders, nextFolder].sort((a, b) =>
          a.name.localeCompare(b.name),
        );
      });

      setInfoMessage("Folder created.");
      setIsCreatingFolder(false);
      router.refresh();
      return nextFolder;
    },
    [
      isCreatingFolder,
      handleApiFailure,
      router,
      setErrorMessage,
      setFolders,
      setInfoMessage,
      setShowAddAnotherAction,
    ],
  );

  const createFolderFromSidebar = useCallback(
    async (name: string): Promise<boolean> => {
      const created = await createFolder(name);
      return Boolean(created);
    },
    [createFolder],
  );

  const handleRenameFolder = useCallback(
    async (folderId: string, name: string): Promise<boolean> => {
      if (deletingFolderId || renamingFolderId || isCreatingFolder) {
        return false;
      }

      setRenamingFolderId(folderId);
      setInfoMessage(null);
      setErrorMessage(null);
      setShowAddAnotherAction(false);

      const result = await renameFolderRequest(folderId, name);
      if (!result.ok || !result.body?.folder?.id) {
        handleApiFailure(result, "folder.rename", "Couldn't rename this folder. Try again.", () => {
          void handleRenameFolder(folderId, name);
        });
        setRenamingFolderId(null);
        return false;
      }

      setFolders((previousFolders) =>
        previousFolders
          .map((folder) =>
            folder.id === folderId
              ? {
                  ...folder,
                  name: result.body?.folder?.name ?? folder.name,
                  updatedAt: result.body?.folder?.updatedAt ?? new Date().toISOString(),
                }
              : folder,
          )
          .sort((a, b) => a.name.localeCompare(b.name)),
      );

      setInfoMessage("Folder name updated.");
      setRenamingFolderId(null);
      router.refresh();
      return true;
    },
    [
      deletingFolderId,
      isCreatingFolder,
      handleApiFailure,
      renamingFolderId,
      router,
      setErrorMessage,
      setFolders,
      setInfoMessage,
      setShowAddAnotherAction,
    ],
  );

  const handleDeleteFolder = useCallback(
    async (folderId: string, mode: FolderDeleteMode): Promise<boolean> => {
      if (deletingFolderId || renamingFolderId || isCreatingFolder) {
        return false;
      }

      setDeletingFolderId(folderId);
      setInfoMessage(null);
      setErrorMessage(null);
      setShowAddAnotherAction(false);

      const result = await deleteFolderRequest(folderId, mode);
      if (!result.ok) {
        handleApiFailure(result, "folder.delete", "Couldn't delete this folder. Try again.", () => {
          void handleDeleteFolder(folderId, mode);
        });
        setDeletingFolderId(null);
        return false;
      }

      setFolders((previousFolders) =>
        previousFolders.filter((folder) => folder.id !== folderId),
      );

      if (mode === "remove_and_unsubscribe_exclusive") {
        setFeeds((previousFeeds) =>
          previousFeeds
            .filter((feed) => {
              if (!feed.folderIds.includes(folderId)) {
                return true;
              }
              return feed.folderIds.length > 1;
            })
            .map((feed) =>
              feed.folderIds.includes(folderId)
                ? {
                    ...feed,
                    folderIds: feed.folderIds.filter(
                      (candidate) => candidate !== folderId,
                    ),
                  }
                : feed,
            ),
        );
      } else {
        setFeeds((previousFeeds) =>
          previousFeeds.map((feed) => ({
            ...feed,
            folderIds: feed.folderIds.filter((candidate) => candidate !== folderId),
          })),
        );
      }

      setSelectedScope((previousScope) => {
        if (previousScope.type === "folder" && previousScope.folderId === folderId) {
          return { type: "all" };
        }
        return previousScope;
      });

      if (mode === "remove_and_unsubscribe_exclusive") {
        const unsubscribedCount = result.body?.unsubscribedFeeds ?? 0;
        setInfoMessage(
          `Folder deleted. Unsubscribed ${unsubscribedCount} exclusive feed${
            unsubscribedCount === 1 ? "" : "s"
          }.`,
        );
      } else {
        setInfoMessage(
          "Folder deleted. Feeds were moved to remaining folders or Uncategorized.",
        );
      }

      setDeletingFolderId(null);
      router.refresh();
      return true;
    },
    [
      deletingFolderId,
      handleApiFailure,
      isCreatingFolder,
      renamingFolderId,
      router,
      setErrorMessage,
      setFeeds,
      setFolders,
      setInfoMessage,
      setSelectedScope,
      setShowAddAnotherAction,
    ],
  );

  return {
    isCreatingFolder,
    deletingFolderId,
    renamingFolderId,
    createFolder,
    createFolderFromSidebar,
    handleRenameFolder,
    handleDeleteFolder,
  };
}
