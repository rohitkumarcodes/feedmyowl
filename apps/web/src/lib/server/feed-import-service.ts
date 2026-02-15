import "server-only";

import { db, eq, folders } from "@/lib/server/database";
import { discoverFeedCandidates } from "@/lib/server/feed-discovery";
import { normalizeFeedError } from "@/lib/shared/feed-errors";
import { normalizeFolderIds } from "@/lib/shared/folder-memberships";
import {
  addFeedFoldersForUser,
  createFeedWithInitialItems,
  findExistingFeedForUserByUrl,
  renameFeedForUser,
} from "@/lib/server/feed-service";
import { parseFeedWithMetadata, type ParsedFeed } from "@/lib/server/feed-parser";
import type {
  FeedImportEntry,
  FeedImportRowResult,
} from "@/lib/shared/feed-import-types";
import {
  FEED_IMPORT_BOUNDED_FETCH_MAX_REDIRECTS,
  FEED_IMPORT_BOUNDED_FETCH_RETRIES,
  FEED_IMPORT_BOUNDED_FETCH_TIMEOUT_MS,
  FEED_IMPORT_DEFAULT_DEADLINE_MS,
} from "@/lib/shared/feed-import-types";
import { createFolderForUser, FOLDER_NAME_MAX_LENGTH } from "@/lib/server/folder-service";
import { normalizeFeedUrl } from "@/lib/shared/feed-url";
import { NO_FEED_FOUND_MESSAGE } from "@/lib/shared/feed-messages";
import { resolveYouTubeChannelFeedUrl } from "@/lib/server/youtube-channel-feed";

const IMPORT_WORKER_CONCURRENCY = 4;
const CUSTOM_TITLE_MAX_LENGTH = 255;
const IMPORT_FAILED_TIMEOUT_MESSAGE =
  "Import timed out before this URL could be processed. Try importing fewer feeds at once.";
const IMPORT_PARSER_FETCH_OPTIONS = {
  timeoutMs: FEED_IMPORT_BOUNDED_FETCH_TIMEOUT_MS,
  retries: FEED_IMPORT_BOUNDED_FETCH_RETRIES,
  maxRedirects: FEED_IMPORT_BOUNDED_FETCH_MAX_REDIRECTS,
} as const;

/**
 * Maximum number of feed-discovery fallback attempts per import batch.
 * Discovery fetches the URL as HTML and scrapes for feed links, so it is
 * expensive. After this many attempts the remaining entries only try
 * direct XML parsing.
 */
const IMPORT_MAX_DISCOVERY_ATTEMPTS = 50;

interface ImportCandidate {
  url: string;
  parsedFeed: ParsedFeed;
  etag: string | null;
  lastModified: string | null;
  existingFeed: NonNullable<
    Awaited<ReturnType<typeof findExistingFeedForUserByUrl>>
  > | null;
}

interface FolderResolveResult {
  folderIds: string[];
  /** Folder names that could not be created (e.g. limit reached). */
  warnings: string[];
}

interface FolderResolver {
  resolveFolderIds(folderNames: string[]): Promise<FolderResolveResult>;
}

function normalizeFolderName(value: string): string {
  return value.trim().slice(0, FOLDER_NAME_MAX_LENGTH);
}

function sanitizeCustomTitle(value: string | null): string | null {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  return trimmed.slice(0, CUSTOM_TITLE_MAX_LENGTH);
}

function toFolderNameLookupKey(folderName: string): string {
  return normalizeFolderName(folderName).toLocaleLowerCase();
}

function isDeadlineExceeded(deadlineAtMs: number): boolean {
  return Date.now() >= deadlineAtMs;
}

function toTimeoutExceededRow(url: string): FeedImportRowResult {
  return {
    url,
    status: "failed",
    code: "timeout_budget_exceeded",
    message: IMPORT_FAILED_TIMEOUT_MESSAGE,
  };
}

async function createFolderResolver(userId: string): Promise<FolderResolver> {
  const folderIdByKey = new Map<string, string>();
  const pendingFolderCreateByKey = new Map<string, Promise<string | null>>();

  const initialFolders = await db.query.folders.findMany({
    where: eq(folders.userId, userId),
    columns: {
      id: true,
      name: true,
    },
  });

  for (const folder of initialFolders) {
    folderIdByKey.set(toFolderNameLookupKey(folder.name), folder.id);
  }

  async function findFolderIdByKey(folderLookupKey: string): Promise<string | null> {
    const currentFolders = await db.query.folders.findMany({
      where: eq(folders.userId, userId),
      columns: {
        id: true,
        name: true,
      },
    });

    for (const folder of currentFolders) {
      const key = toFolderNameLookupKey(folder.name);
      if (!key) {
        continue;
      }
      folderIdByKey.set(key, folder.id);
    }

    return folderIdByKey.get(folderLookupKey) || null;
  }

  async function ensureFolderId(folderName: string): Promise<string | null> {
    const normalizedName = normalizeFolderName(folderName);
    if (!normalizedName) {
      return null;
    }

    const lookupKey = toFolderNameLookupKey(normalizedName);
    if (!lookupKey) {
      return null;
    }

    const knownFolderId = folderIdByKey.get(lookupKey);
    if (knownFolderId) {
      return knownFolderId;
    }

    const pendingFolder = pendingFolderCreateByKey.get(lookupKey);
    if (pendingFolder) {
      return await pendingFolder;
    }

    const folderCreatePromise = (async (): Promise<string | null> => {
      const createdFolder = await createFolderForUser(userId, normalizedName);

      if (createdFolder.status === "ok") {
        folderIdByKey.set(lookupKey, createdFolder.folder.id);
        return createdFolder.folder.id;
      }

      if (createdFolder.status === "duplicate_name") {
        return await findFolderIdByKey(lookupKey);
      }

      return null;
    })();

    pendingFolderCreateByKey.set(lookupKey, folderCreatePromise);

    try {
      return await folderCreatePromise;
    } finally {
      pendingFolderCreateByKey.delete(lookupKey);
    }
  }

  return {
    async resolveFolderIds(folderNames: string[]): Promise<FolderResolveResult> {
      const resolvedFolderIds: string[] = [];
      const warnings: string[] = [];

      for (const folderName of folderNames) {
        const resolvedFolderId = await ensureFolderId(folderName);
        if (resolvedFolderId) {
          resolvedFolderIds.push(resolvedFolderId);
        } else {
          const normalizedName = normalizeFolderName(folderName);
          if (normalizedName) {
            warnings.push(`Folder "${normalizedName}" could not be created.`);
          }
        }
      }

      return {
        folderIds: normalizeFolderIds(resolvedFolderIds),
        warnings,
      };
    },
  };
}

function mapFailureFromFeedError(
  error: unknown,
): Pick<FeedImportRowResult, "code" | "message"> {
  const normalized = normalizeFeedError(error, "create");

  if (normalized.code === "timeout") {
    return {
      code: "network_timeout",
      message: normalized.message,
    };
  }

  if (normalized.code === "invalid_xml") {
    return {
      code: "invalid_xml",
      message: normalized.message,
    };
  }

  return {
    code: "unknown",
    message: normalized.message,
  };
}

async function mergeDuplicateFeedFolders(params: {
  userId: string;
  importUrl: string;
  existingFeed: NonNullable<
    Awaited<ReturnType<typeof findExistingFeedForUserByUrl>>
  > | null;
  resolvedFolderIds: string[];
}): Promise<FeedImportRowResult> {
  if (!params.existingFeed) {
    return {
      url: params.importUrl,
      status: "failed",
      code: "unknown",
      message: "Could not resolve duplicate feed details.",
    };
  }

  if (params.resolvedFolderIds.length === 0) {
    return {
      url: params.importUrl,
      status: "duplicate_unchanged",
      code: "duplicate",
      feedId: params.existingFeed.id,
      message: "This feed is already in your library.",
    };
  }

  const folderAddResult = await addFeedFoldersForUser(
    params.userId,
    params.existingFeed.id,
    params.resolvedFolderIds,
  );

  if (folderAddResult.status !== "ok") {
    return {
      url: params.importUrl,
      status: "failed",
      code: "unknown",
      message: "Could not merge imported folder assignments.",
      feedId: params.existingFeed.id,
    };
  }

  if (folderAddResult.addedFolderIds.length === 0) {
    return {
      url: params.importUrl,
      status: "duplicate_unchanged",
      code: "duplicate",
      feedId: params.existingFeed.id,
      message: "This feed is already in your library.",
    };
  }

  return {
    url: params.importUrl,
    status: "duplicate_merged",
    code: "duplicate",
    feedId: params.existingFeed.id,
    message: "Existing feed matched; folder assignments were merged.",
  };
}

async function resolveImportCandidate(params: {
  userId: string;
  normalizedInputUrl: string;
  skipMultiCandidate: boolean;
  /** Shared counter — when it reaches 0, discovery fallback is skipped. */
  discoveryBudget: { remaining: number };
  deadlineAtMs: number;
}): Promise<
  | {
      status: "candidate";
      candidate: ImportCandidate;
    }
  | {
      status: "skipped_multiple";
      message: string;
    }
  | {
      status: "failed";
      message: string;
      code: FeedImportRowResult["code"];
    }
> {
  if (isDeadlineExceeded(params.deadlineAtMs)) {
    return {
      status: "failed",
      code: "timeout_budget_exceeded",
      message: IMPORT_FAILED_TIMEOUT_MESSAGE,
    };
  }

  const preferredUrl =
    (await resolveYouTubeChannelFeedUrl(params.normalizedInputUrl)) ??
    params.normalizedInputUrl;

  let directExistingFeed = await findExistingFeedForUserByUrl(
    params.userId,
    preferredUrl,
  );
  if (!directExistingFeed && preferredUrl !== params.normalizedInputUrl) {
    directExistingFeed = await findExistingFeedForUserByUrl(
      params.userId,
      params.normalizedInputUrl,
    );
  }
  let directFailureAfterFallback: {
    code: FeedImportRowResult["code"];
    message: string;
  } | null = null;

  if (directExistingFeed) {
    return {
      status: "candidate",
      candidate: {
        url: preferredUrl,
        parsedFeed: {
          title: undefined,
          description: undefined,
          items: [],
        },
        etag: null,
        lastModified: null,
        existingFeed: directExistingFeed,
      },
    };
  }

  try {
    const parsedDirectFeed = await parseFeedWithMetadata(
      preferredUrl,
      IMPORT_PARSER_FETCH_OPTIONS,
    );
    const resolvedExistingFeed = await findExistingFeedForUserByUrl(
      params.userId,
      parsedDirectFeed.resolvedUrl,
    );

    return {
      status: "candidate",
      candidate: {
        url: parsedDirectFeed.resolvedUrl,
        parsedFeed: parsedDirectFeed.parsedFeed,
        etag: parsedDirectFeed.etag,
        lastModified: parsedDirectFeed.lastModified,
        existingFeed: resolvedExistingFeed ?? null,
      },
    };
  } catch (error) {
    const normalizedDirectError = normalizeFeedError(error, "create");
    if (normalizedDirectError.code !== "invalid_xml") {
      const mappedFailure = mapFailureFromFeedError(error);
      directFailureAfterFallback = {
        code: mappedFailure.code,
        message: mappedFailure.message || "Could not import this feed.",
      };
    }
  }

  // Skip discovery if the per-batch budget is exhausted.
  if (isDeadlineExceeded(params.deadlineAtMs)) {
    return {
      status: "failed",
      code: "timeout_budget_exceeded",
      message: IMPORT_FAILED_TIMEOUT_MESSAGE,
    };
  }

  if (params.discoveryBudget.remaining <= 0) {
    if (directFailureAfterFallback) {
      return {
        status: "failed",
        code: directFailureAfterFallback.code,
        message: directFailureAfterFallback.message,
      };
    }

    return {
      status: "failed",
      code: "invalid_xml",
      message: NO_FEED_FOUND_MESSAGE,
    };
  }

  params.discoveryBudget.remaining -= 1;

  const discovery = await discoverFeedCandidates(params.normalizedInputUrl);
  const validatedCandidates: ImportCandidate[] = [];

  for (const discoveredUrl of discovery.candidates) {
    if (isDeadlineExceeded(params.deadlineAtMs)) {
      return {
        status: "failed",
        code: "timeout_budget_exceeded",
        message: IMPORT_FAILED_TIMEOUT_MESSAGE,
      };
    }

    try {
      const parsedCandidateFeed = await parseFeedWithMetadata(
        discoveredUrl,
        IMPORT_PARSER_FETCH_OPTIONS,
      );
      const existingFeed = await findExistingFeedForUserByUrl(
        params.userId,
        parsedCandidateFeed.resolvedUrl,
      );

      validatedCandidates.push({
        url: parsedCandidateFeed.resolvedUrl,
        parsedFeed: parsedCandidateFeed.parsedFeed,
        etag: parsedCandidateFeed.etag,
        lastModified: parsedCandidateFeed.lastModified,
        existingFeed: existingFeed ?? null,
      });
    } catch {
      // Keep trying additional candidates.
    }
  }

  if (validatedCandidates.length === 0) {
    if (directFailureAfterFallback) {
      return {
        status: "failed",
        code: directFailureAfterFallback.code,
        message: directFailureAfterFallback.message,
      };
    }

    return {
      status: "failed",
      code: "invalid_xml",
      message: NO_FEED_FOUND_MESSAGE,
    };
  }

  const addableCandidates = validatedCandidates.filter(
    (candidate) => !candidate.existingFeed,
  );
  const duplicateCandidates = validatedCandidates.filter(
    (candidate) => candidate.existingFeed,
  );

  if (params.skipMultiCandidate && addableCandidates.length > 1) {
    return {
      status: "skipped_multiple",
      message:
        "Multiple feed candidates were found for this URL. Add it individually to choose one.",
    };
  }

  if (
    params.skipMultiCandidate &&
    addableCandidates.length === 0 &&
    duplicateCandidates.length > 1
  ) {
    return {
      status: "skipped_multiple",
      message:
        "Multiple already-subscribed feed candidates were found for this URL. Add it individually to resolve.",
    };
  }

  if (addableCandidates.length > 0) {
    return {
      status: "candidate",
      candidate: addableCandidates[0],
    };
  }

  if (duplicateCandidates.length > 0) {
    return {
      status: "candidate",
      candidate: duplicateCandidates[0],
    };
  }

  return {
    status: "failed",
    code: "invalid_xml",
    message: NO_FEED_FOUND_MESSAGE,
  };
}

async function importOneFeedEntry(params: {
  userId: string;
  entry: FeedImportEntry;
  skipMultiCandidate: boolean;
  folderResolver: FolderResolver;
  discoveryBudget: { remaining: number };
  deadlineAtMs: number;
}): Promise<FeedImportRowResult> {
  if (isDeadlineExceeded(params.deadlineAtMs)) {
    return toTimeoutExceededRow(params.entry.url);
  }

  const normalizedInputUrl = normalizeFeedUrl(params.entry.url);
  if (!normalizedInputUrl) {
    return {
      url: params.entry.url,
      status: "failed",
      code: "invalid_url",
      message: "This URL does not appear to be valid.",
    };
  }

  const candidateResult = await resolveImportCandidate({
    userId: params.userId,
    normalizedInputUrl,
    skipMultiCandidate: params.skipMultiCandidate,
    discoveryBudget: params.discoveryBudget,
    deadlineAtMs: params.deadlineAtMs,
  });

  if (candidateResult.status === "failed") {
    return {
      url: normalizedInputUrl,
      status: "failed",
      code: candidateResult.code,
      message: candidateResult.message,
    };
  }

  if (candidateResult.status === "skipped_multiple") {
    return {
      url: normalizedInputUrl,
      status: "skipped_multiple_candidates",
      code: "multiple_candidates",
      message: candidateResult.message,
    };
  }

  if (isDeadlineExceeded(params.deadlineAtMs)) {
    return toTimeoutExceededRow(normalizedInputUrl);
  }

  const candidate = candidateResult.candidate;
  const folderResult = await params.folderResolver.resolveFolderIds(
    params.entry.folderNames,
  );
  const resolvedFolderIds = folderResult.folderIds;
  const folderWarnings =
    folderResult.warnings.length > 0 ? folderResult.warnings : undefined;

  if (candidate.existingFeed) {
    const mergeResult = await mergeDuplicateFeedFolders({
      userId: params.userId,
      importUrl: normalizedInputUrl,
      existingFeed: candidate.existingFeed,
      resolvedFolderIds,
    });
    if (folderWarnings) {
      mergeResult.warnings = [...(mergeResult.warnings ?? []), ...folderWarnings];
    }
    return mergeResult;
  }

  try {
    if (isDeadlineExceeded(params.deadlineAtMs)) {
      return toTimeoutExceededRow(normalizedInputUrl);
    }

    const created = await createFeedWithInitialItems(
      params.userId,
      candidate.url,
      candidate.parsedFeed,
      resolvedFolderIds,
      {
        etag: candidate.etag,
        lastModified: candidate.lastModified,
      },
    );

    const customTitle = sanitizeCustomTitle(params.entry.customTitle);
    if (customTitle) {
      await renameFeedForUser(params.userId, created.feed.id, customTitle);
    }

    return {
      url: normalizedInputUrl,
      status: "imported",
      feedId: created.feed.id,
      message:
        candidate.url !== normalizedInputUrl
          ? "Feed found automatically and added."
          : undefined,
      warnings: folderWarnings,
    };
  } catch (error) {
    const raceDuplicate = await findExistingFeedForUserByUrl(
      params.userId,
      candidate.url,
    );

    if (raceDuplicate) {
      const mergeResult = await mergeDuplicateFeedFolders({
        userId: params.userId,
        importUrl: normalizedInputUrl,
        existingFeed: raceDuplicate,
        resolvedFolderIds,
      });
      if (folderWarnings) {
        mergeResult.warnings = [...(mergeResult.warnings ?? []), ...folderWarnings];
      }
      return mergeResult;
    }

    const mappedFailure = mapFailureFromFeedError(error);
    return {
      url: normalizedInputUrl,
      status: "failed",
      code: mappedFailure.code,
      message: mappedFailure.message,
    };
  }
}

export async function importFeedEntriesForUser(params: {
  userId: string;
  entries: FeedImportEntry[];
  skipMultiCandidate?: boolean;
  deadlineMs?: number;
}): Promise<FeedImportRowResult[]> {
  if (params.entries.length === 0) {
    return [];
  }

  const skipMultiCandidate = params.skipMultiCandidate !== false;
  const deadlineMs = Math.max(
    1_000,
    params.deadlineMs ?? FEED_IMPORT_DEFAULT_DEADLINE_MS,
  );
  const deadlineAtMs = Date.now() + deadlineMs;
  const folderResolver = await createFolderResolver(params.userId);

  // Shared mutable budget — workers decrement it as they attempt discovery.
  const discoveryBudget = { remaining: IMPORT_MAX_DISCOVERY_ATTEMPTS };

  const workerCount = Math.max(
    1,
    Math.min(IMPORT_WORKER_CONCURRENCY, params.entries.length),
  );
  const results: FeedImportRowResult[] = new Array(params.entries.length);
  let cursor = 0;

  async function runWorker(): Promise<void> {
    while (true) {
      const nextIndex = cursor;
      cursor += 1;

      if (nextIndex >= params.entries.length) {
        return;
      }

      const entry = params.entries[nextIndex];

      try {
        if (isDeadlineExceeded(deadlineAtMs)) {
          results[nextIndex] = toTimeoutExceededRow(entry.url);
          continue;
        }

        results[nextIndex] = await importOneFeedEntry({
          userId: params.userId,
          entry,
          skipMultiCandidate,
          folderResolver,
          discoveryBudget,
          deadlineAtMs,
        });
      } catch {
        results[nextIndex] = {
          url: entry.url,
          status: "failed",
          code: "unknown",
          message: "Could not import this feed.",
        };
      }
    }
  }

  await Promise.all(Array.from({ length: workerCount }, () => runWorker()));

  return results;
}
