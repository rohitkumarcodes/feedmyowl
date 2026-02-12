import type {
  FeedImportEntry,
  FeedImportRowResult,
} from "@/lib/feed-import-types";

export const IMPORT_RATE_LIMIT_MAX_RETRIES = 2;
const IMPORT_RATE_LIMIT_RETRY_FALLBACK_SECONDS = 5;
const IMPORT_RATE_LIMIT_RETRY_MIN_SECONDS = 1;
const IMPORT_RATE_LIMIT_RETRY_MAX_SECONDS = 30;

function clampRetryDelaySeconds(rawSeconds: number): number {
  if (!Number.isFinite(rawSeconds)) {
    return IMPORT_RATE_LIMIT_RETRY_FALLBACK_SECONDS;
  }

  return Math.min(
    IMPORT_RATE_LIMIT_RETRY_MAX_SECONDS,
    Math.max(IMPORT_RATE_LIMIT_RETRY_MIN_SECONDS, Math.ceil(rawSeconds))
  );
}

function toFallbackRow(url: string, message: string): FeedImportRowResult {
  return {
    url,
    status: "failed",
    code: "unknown",
    message,
  };
}

function isImportRowResult(value: unknown): value is FeedImportRowResult {
  return Boolean(
    value &&
      typeof value === "object" &&
      typeof (value as FeedImportRowResult).url === "string" &&
      typeof (value as FeedImportRowResult).status === "string"
  );
}

export function parseRetryAfterSeconds(
  retryAfterHeader: string | null,
  nowMs = Date.now()
): number {
  if (!retryAfterHeader) {
    return IMPORT_RATE_LIMIT_RETRY_FALLBACK_SECONDS;
  }

  const trimmed = retryAfterHeader.trim();
  if (!trimmed) {
    return IMPORT_RATE_LIMIT_RETRY_FALLBACK_SECONDS;
  }

  const asSeconds = Number(trimmed);
  if (Number.isFinite(asSeconds)) {
    return clampRetryDelaySeconds(asSeconds);
  }

  const asDateMs = Date.parse(trimmed);
  if (Number.isFinite(asDateMs)) {
    return clampRetryDelaySeconds((asDateMs - nowMs) / 1000);
  }

  return IMPORT_RATE_LIMIT_RETRY_FALLBACK_SECONDS;
}

export function buildChunkFallbackRows(
  entries: FeedImportEntry[],
  message: string
): FeedImportRowResult[] {
  return entries.map((entry) => toFallbackRow(entry.url, message));
}

export function reconcileChunkRowsByUrl(params: {
  entries: FeedImportEntry[];
  rows: unknown[];
  fallbackMessage: string;
}): FeedImportRowResult[] {
  const chunkUrlSet = new Set(params.entries.map((entry) => entry.url));
  const rowByUrl = new Map<string, FeedImportRowResult>();

  for (const row of params.rows) {
    if (!isImportRowResult(row)) {
      continue;
    }

    if (!chunkUrlSet.has(row.url) || rowByUrl.has(row.url)) {
      continue;
    }

    rowByUrl.set(row.url, row);
  }

  return params.entries.map(
    (entry) => rowByUrl.get(entry.url) || toFallbackRow(entry.url, params.fallbackMessage)
  );
}

export function isImportFailureRow(row: FeedImportRowResult): boolean {
  return row.status === "failed" || row.status === "skipped_multiple_candidates";
}

export function buildImportFailureReport(params: {
  fileName: string;
  failedRows: FeedImportRowResult[];
  generatedAtIso?: string;
}): string {
  const generatedAtIso = params.generatedAtIso || new Date().toISOString();
  const lines = [
    "FeedMyOwl import failure report",
    `Source file: ${params.fileName}`,
    `Generated at: ${generatedAtIso}`,
    `Failed entries: ${params.failedRows.length}`,
    "",
  ];

  for (const row of params.failedRows) {
    const code = row.code ? ` [${row.code}]` : "";
    const message = row.message || "Could not import.";
    lines.push(`${row.url}${code} - ${message}`);
  }

  return `${lines.join("\n")}\n`;
}
