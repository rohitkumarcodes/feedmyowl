export type FeedImportSourceType = "OPML" | "JSON";

export const FEED_IMPORT_MAX_ENTRIES_PER_REQUEST = 50;
export const FEED_IMPORT_CLIENT_CHUNK_SIZE = 20;
export const FEED_IMPORT_MAX_TOTAL_ENTRIES = 500;

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
    | "duplicate"
    | "unknown";
  feedId?: string;
}

export interface FeedImportResponse {
  processedCount: number;
  importedCount: number;
  duplicateCount: number;
  mergedCount: number;
  failedCount: number;
  rows: FeedImportRowResult[];
}
