import type { IsoDateString } from "./common";

export interface FolderDto {
  id: string;
  name: string;
  createdAt: IsoDateString;
  updatedAt: IsoDateString;
}

export interface FeedItemDto {
  id: string;
  feedId: string;
  guid: string | null;
  title: string | null;
  link: string | null;
  content: string | null;
  author: string | null;
  publishedAt: IsoDateString | null;
  readAt: IsoDateString | null;
  createdAt: IsoDateString;
  updatedAt: IsoDateString;
}

export interface FeedDto {
  id: string;
  userId: string;
  url: string;
  title: string | null;
  customTitle: string | null;
  description: string | null;
  lastFetchedAt: IsoDateString | null;
  lastFetchStatus: string | null;
  lastFetchErrorCode: string | null;
  lastFetchErrorMessage: string | null;
  lastFetchErrorAt: IsoDateString | null;
  createdAt: IsoDateString;
  updatedAt: IsoDateString;
  items: FeedItemDto[];
  folderIds: string[];
}

export interface FeedsGetResponseBody {
  feeds: FeedDto[];
  folders: FolderDto[];
}

export type FeedDiscoveryCandidateMethod = "direct" | "html_alternate" | "heuristic_path";

export interface FeedDiscoveryCandidateDto {
  url: string;
  title: string | null;
  method: FeedDiscoveryCandidateMethod;
  duplicate: boolean;
  existingFeedId: string | null;
}

export type FeedsDiscoverStatus = "single" | "multiple" | "duplicate";

export interface FeedsDiscoverResponseBody {
  status: FeedsDiscoverStatus;
  normalizedInputUrl: string;
  candidates: FeedDiscoveryCandidateDto[];
}

export type FeedsPostRequestBody =
  | { action: "feed.discover"; url: string }
  | { action: "feed.create"; url: string; folderIds?: string[] };

export interface FeedCreateDto {
  id: string;
  title?: string | null;
  customTitle?: string | null;
  description?: string | null;
  url: string;
  folderIds?: string[];
  lastFetchedAt?: IsoDateString | null;
  lastFetchStatus?: string | null;
  lastFetchErrorCode?: string | null;
  lastFetchErrorMessage?: string | null;
  lastFetchErrorAt?: IsoDateString | null;
  createdAt?: IsoDateString;
  updatedAt?: IsoDateString;
  [key: string]: unknown;
}

export interface FeedsCreateDuplicateResponseBody {
  feed: FeedCreateDto;
  duplicate: true;
  mergedFolderCount: number;
  message: string;
}

export interface FeedsCreateOkResponseBody {
  feed: FeedCreateDto;
  importedItemCount: number;
  duplicate: false;
  message?: string;
}

export type FeedsCreateResponseBody =
  | FeedsCreateDuplicateResponseBody
  | FeedsCreateOkResponseBody;

export type FeedsPatchRequestBody =
  | { action: "item.markRead"; itemId: string }
  | { action: "items.markAllRead"; scopeType: string; scopeId?: string }
  | { action: "uncategorized.delete"; confirm: boolean }
  | { action: "uncategorized.move_to_folder"; folderId: string }
  | { action: "account.delete"; confirm: boolean };

export interface MarkReadResponseBody {
  itemId: string;
  readAt: IsoDateString;
  alreadyRead?: boolean;
}

export interface UncategorizedDeleteResponseBody {
  success: true;
  deletedFeedCount: number;
}

export interface UncategorizedMoveResponseBody {
  success: true;
  totalUncategorizedCount: number;
  movedFeedCount: number;
  failedFeedCount: number;
}

export interface MarkAllReadResponseBody {
  success: true;
  markedCount: number;
}

export interface AccountDeleteResponseBody {
  success: true;
}

export type FeedsPatchResponseBody =
  | MarkReadResponseBody
  | MarkAllReadResponseBody
  | UncategorizedDeleteResponseBody
  | UncategorizedMoveResponseBody
  | AccountDeleteResponseBody;

export type FeedIdPatchRequestBody =
  | { action: "feed.setFolders"; folderIds: string[] }
  | { name: string };

export interface FeedIdPatchResponseBody {
  feed: {
    id: string;
    folderIds?: string[];
    url?: string;
    title?: string | null;
    customTitle?: string | null;
    updatedAt?: IsoDateString;
  };
}

export interface FeedIdDeleteResponseBody {
  success: true;
}
