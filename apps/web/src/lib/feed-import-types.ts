export type FeedImportSourceType = "OPML" | "JSON";

export const FEED_IMPORT_MAX_ENTRIES_PER_REQUEST = 50;
export const FEED_IMPORT_CLIENT_CHUNK_SIZE = 20;
export const FEED_IMPORT_MAX_TOTAL_ENTRIES = 500;
export const FEED_IMPORT_MAX_REQUEST_BYTES = 1_000_000;
export const FEED_IMPORT_MAX_FOLDER_NAMES_PER_ENTRY = 25;
export const FEED_IMPORT_MAX_URL_LENGTH = 2_048;
export const FEED_IMPORT_MAX_CUSTOM_TITLE_LENGTH = 255;
export const FEED_IMPORT_DEFAULT_DEADLINE_MS = 45_000;
export const FEED_IMPORT_BOUNDED_FETCH_TIMEOUT_MS = 7_000;
export const FEED_IMPORT_BOUNDED_FETCH_RETRIES = 1;
export const FEED_IMPORT_BOUNDED_FETCH_MAX_REDIRECTS = 3;

/** Maximum import file size in bytes (10 MB). */
export const FEED_IMPORT_MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;

export interface FeedImportEntry {
  url: string;
  folderNames: string[];
  customTitle: string | null;
}

export interface FeedImportRequest {
  sourceType: FeedImportSourceType;
  entries: FeedImportEntry[];
  options?: { skipMultiCandidate?: boolean };
}

export type FeedImportRowStatus =
  | "imported"
  | "duplicate_merged"
  | "duplicate_unchanged"
  | "skipped_multiple_candidates"
  | "failed";

export interface FeedImportRowResult {
  url: string;
  status: FeedImportRowStatus;
  message?: string;
  code?:
    | "invalid_url"
    | "invalid_xml"
    | "multiple_candidates"
    | "network_timeout"
    | "timeout_budget_exceeded"
    | "duplicate"
    | "unknown";
  feedId?: string;
  /** Non-fatal issues encountered while processing this entry. */
  warnings?: string[];
}

export interface FeedImportResponse {
  processedCount: number;
  importedCount: number;
  duplicateCount: number;
  mergedCount: number;
  failedCount: number;
  rows: FeedImportRowResult[];
}

/**
 * Status of a single feed entry in the import preview.
 */
export type FeedImportPreviewStatus = "new" | "duplicate" | "error";

/**
 * Single feed entry for the import preview.
 */
export interface FeedImportPreviewEntry {
  url: string;
  customTitle: string | null;
  folderNames: string[];
  status: FeedImportPreviewStatus;
  existingFeedId?: string;
  existingFolderNames?: string[];
  errorMessage?: string;
}

/**
 * Import preview result showing all feeds with their status.
 */
export interface FeedImportPreview {
  sourceType: FeedImportSourceType;
  fileName: string;
  totalCount: number;
  newCount: number;
  duplicateCount: number;
  errorCount: number;
  folderNames: string[];
  entries: FeedImportPreviewEntry[];
}
