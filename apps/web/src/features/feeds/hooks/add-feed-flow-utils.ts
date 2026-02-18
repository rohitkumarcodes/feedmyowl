import type { FeedViewModel } from "@/features/feeds/types/view-models";
import { normalizeFeedUrl } from "@/lib/shared/feed-url";

export interface AddFeedCreateResponseFeed {
  id: string;
  title?: string | null;
  customTitle?: string | null;
  description?: string | null;
  url: string;
  folderIds?: string[];
  lastFetchedAt?: string | null;
  lastFetchStatus?: string | null;
  lastFetchErrorCode?: string | null;
  lastFetchErrorMessage?: string | null;
  lastFetchErrorAt?: string | null;
  createdAt?: string;
}

export function shouldBlockExactDuplicateAdd(params: {
  isExactDuplicate: boolean;
  selectedFolderIds: readonly string[];
}): boolean {
  return params.isExactDuplicate && params.selectedFolderIds.length === 0;
}

export function getInlineDuplicateMessage(params: {
  isExactDuplicate: boolean;
  selectedFolderIds: readonly string[];
}): string | null {
  if (!params.isExactDuplicate) {
    return null;
  }

  if (params.selectedFolderIds.length > 0) {
    return "This feed is already in your library. Add it to update folder assignments.";
  }

  return "This feed is already in your library.";
}

export function resolveExistingFeedTargetId(params: {
  url: string;
  existingFeedId?: string | null;
  knownFeedIds: ReadonlySet<string>;
  feedIdByNormalizedUrl: ReadonlyMap<string, string>;
}): string | null {
  if (params.existingFeedId && params.knownFeedIds.has(params.existingFeedId)) {
    return params.existingFeedId;
  }

  const normalizedUrl = normalizeFeedUrl(params.url);
  if (!normalizedUrl) {
    return null;
  }

  return params.feedIdByNormalizedUrl.get(normalizedUrl) ?? null;
}

export function mergeExistingFeedPatch(
  currentFeed: FeedViewModel,
  patch: AddFeedCreateResponseFeed,
): FeedViewModel {
  return {
    ...currentFeed,
    folderIds: patch.folderIds !== undefined ? patch.folderIds : currentFeed.folderIds,
    customTitle:
      patch.customTitle !== undefined ? patch.customTitle : currentFeed.customTitle,
    title: patch.title !== undefined ? patch.title : currentFeed.title,
    description: patch.description !== undefined ? patch.description : currentFeed.description,
    lastFetchedAt:
      patch.lastFetchedAt !== undefined ? patch.lastFetchedAt : currentFeed.lastFetchedAt,
    lastFetchStatus:
      patch.lastFetchStatus !== undefined
        ? patch.lastFetchStatus
        : currentFeed.lastFetchStatus,
    lastFetchErrorCode:
      patch.lastFetchErrorCode !== undefined
        ? patch.lastFetchErrorCode
        : currentFeed.lastFetchErrorCode,
    lastFetchErrorMessage:
      patch.lastFetchErrorMessage !== undefined
        ? patch.lastFetchErrorMessage
        : currentFeed.lastFetchErrorMessage,
    lastFetchErrorAt:
      patch.lastFetchErrorAt !== undefined
        ? patch.lastFetchErrorAt
        : currentFeed.lastFetchErrorAt,
  };
}
