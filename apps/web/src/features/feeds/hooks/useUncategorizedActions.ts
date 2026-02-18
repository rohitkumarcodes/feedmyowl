"use client";

import { useCallback, useState } from "react";
import type { FeedViewModel } from "@/features/feeds/types/view-models";
import type { SidebarScope } from "@/features/feeds/types/scopes";
import type { FeedActionNoticeOptions } from "@/features/feeds/hooks/useFeedActionStatus";
import {
  deleteUncategorizedFeeds as deleteUncategorizedFeedsRequest,
  moveUncategorizedFeedsToFolder as moveUncategorizedFeedsToFolderRequest,
} from "@/lib/client/feeds";
import type { ApiErrorBody } from "@/contracts/api/common";
import {
  mapApiCallResultToUiMessage,
  type UiActionContext,
} from "@/lib/shared/ui-messages";

interface UseUncategorizedActionsOptions {
  router: { refresh(): void };
  setFeeds: React.Dispatch<React.SetStateAction<FeedViewModel[]>>;
  setSelectedScope: React.Dispatch<React.SetStateAction<SidebarScope>>;
  setInfoMessage: (message: string | null, options?: FeedActionNoticeOptions) => void;
  setErrorMessage: (message: string | null, options?: FeedActionNoticeOptions) => void;
  setShowAddAnotherAction: React.Dispatch<React.SetStateAction<boolean>>;
  deletingFolderId: string | null;
  renamingFolderId: string | null;
  isCreatingFolder: boolean;
}

export function useUncategorizedActions({
  router,
  setFeeds,
  setSelectedScope,
  setInfoMessage,
  setErrorMessage,
  setShowAddAnotherAction,
  deletingFolderId,
  renamingFolderId,
  isCreatingFolder,
}: UseUncategorizedActionsOptions) {
  const [isDeletingUncategorized, setIsDeletingUncategorized] = useState(false);
  const [isMovingUncategorized, setIsMovingUncategorized] = useState(false);

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
        source: "workspace",
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

  const handleDeleteUncategorizedFeeds = useCallback(async (): Promise<boolean> => {
    if (
      isDeletingUncategorized ||
      deletingFolderId ||
      renamingFolderId ||
      isCreatingFolder
    ) {
      return false;
    }

    setIsDeletingUncategorized(true);
    setInfoMessage(null);
    setErrorMessage(null);
    setShowAddAnotherAction(false);

    const result = await deleteUncategorizedFeedsRequest(true);
    if (
      !result.ok ||
      !result.body ||
      !("success" in result.body) ||
      !result.body.success
    ) {
      handleApiFailure(
        result,
        "uncategorized.delete",
        "Couldn't delete uncategorized feeds. Try again.",
        () => {
          void handleDeleteUncategorizedFeeds();
        },
      );
      setIsDeletingUncategorized(false);
      return false;
    }

    const deletedFeedCount = result.body.deletedFeedCount ?? 0;

    setFeeds((previousFeeds) =>
      previousFeeds.filter((feed) => feed.folderIds.length > 0),
    );

    setSelectedScope((previousScope) => {
      if (previousScope.type === "uncategorized") {
        return { type: "all" };
      }
      return previousScope;
    });

    setInfoMessage(
      deletedFeedCount > 0
        ? `Deleted ${deletedFeedCount} uncategorized feed${
            deletedFeedCount === 1 ? "" : "s"
          }.`
        : "No uncategorized feeds to delete.",
    );

    setIsDeletingUncategorized(false);
    router.refresh();
    return true;
  }, [
    deletingFolderId,
    handleApiFailure,
    isCreatingFolder,
    isDeletingUncategorized,
    renamingFolderId,
    router,
    setErrorMessage,
    setFeeds,
    setInfoMessage,
    setSelectedScope,
    setShowAddAnotherAction,
  ]);

  const handleMoveUncategorizedFeeds = useCallback(
    async (folderId: string): Promise<boolean> => {
      if (
        !folderId ||
        isMovingUncategorized ||
        isDeletingUncategorized ||
        deletingFolderId ||
        renamingFolderId ||
        isCreatingFolder
      ) {
        return false;
      }

      setIsMovingUncategorized(true);
      setShowAddAnotherAction(false);

      const result = await moveUncategorizedFeedsToFolderRequest(folderId);
      if (
        !result.ok ||
        !result.body ||
        !("success" in result.body) ||
        !result.body.success
      ) {
        handleApiFailure(
          result,
          "uncategorized.move",
          "Couldn't move uncategorized feeds. Try again.",
          () => {
            void handleMoveUncategorizedFeeds(folderId);
          },
        );
        setIsMovingUncategorized(false);
        return false;
      }

      setFeeds((previousFeeds) =>
        previousFeeds.map((feed) => {
          if (feed.folderIds.length > 0) {
            return feed;
          }

          return {
            ...feed,
            folderIds: [folderId],
          };
        }),
      );

      setSelectedScope((previousScope) => {
        if (previousScope.type === "uncategorized") {
          return { type: "all" };
        }
        return previousScope;
      });

      const movedFeedCount = result.body.movedFeedCount ?? 0;
      const failedFeedCount = result.body.failedFeedCount ?? 0;

      if (failedFeedCount > 0) {
        setErrorMessage(
          `Completed with issues: ${movedFeedCount} succeeded, ${failedFeedCount} need attention.`,
          {
            severity: "warning",
            title: "Partial move",
            source: "workspace",
            dedupeKey: "uncategorized.move.partial",
          },
        );
      } else {
        setInfoMessage(
          movedFeedCount > 0
            ? `Moved ${movedFeedCount} uncategorized feed${
                movedFeedCount === 1 ? "" : "s"
              } to the selected folder.`
            : "No uncategorized feeds to move.",
        );
      }

      setIsMovingUncategorized(false);
      router.refresh();
      return true;
    },
    [
      deletingFolderId,
      handleApiFailure,
      isCreatingFolder,
      isDeletingUncategorized,
      isMovingUncategorized,
      renamingFolderId,
      router,
      setErrorMessage,
      setFeeds,
      setInfoMessage,
      setSelectedScope,
      setShowAddAnotherAction,
    ],
  );

  return {
    isDeletingUncategorized,
    isMovingUncategorized,
    handleDeleteUncategorizedFeeds,
    handleMoveUncategorizedFeeds,
  };
}
