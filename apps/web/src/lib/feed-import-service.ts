import {
  and,
  db,
  eq,
  feedFolderMemberships,
  folders,
} from "@/lib/database";
import { isMissingRelationError } from "@/lib/db-compat";
import { discoverFeedCandidates } from "@/lib/feed-discovery";
import { normalizeFeedError } from "@/lib/feed-errors";
import {
  normalizeFolderIds,
  resolveFeedFolderIds,
} from "@/lib/folder-memberships";
import {
  createFeedWithInitialItems,
  findExistingFeedForUserByUrl,
  renameFeedForUser,
  setFeedFoldersForUser,
} from "@/lib/feed-service";
import { parseFeedWithMetadata, type ParsedFeed } from "@/lib/feed-parser";
import type {
  FeedImportEntry,
  FeedImportRowResult,
} from "@/lib/feed-import-types";
import {
  createFolderForUser,
  FOLDER_NAME_MAX_LENGTH,
} from "@/lib/folder-service";
import { normalizeFeedUrl } from "@/lib/feed-url";

const NO_FEED_FOUND_MESSAGE =
  "Error: We couldn't find any feed at this URL. Contact site owner and ask for the feed link.";
const IMPORT_WORKER_CONCURRENCY = 4;
const CUSTOM_TITLE_MAX_LENGTH = 255;

interface ImportCandidate {
  url: string;
  parsedFeed: ParsedFeed;
  etag: string | null;
  lastModified: string | null;
  existingFeed:
    | NonNullable<Awaited<ReturnType<typeof findExistingFeedForUserByUrl>>>
    | null;
}

interface FolderResolver {
  resolveFolderIds(folderNames: string[]): Promise<string[]>;
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

function areSortedStringListsEqual(a: string[], b: string[]): boolean {
  if (a.length !== b.length) {
    return false;
  }

  for (let index = 0; index < a.length; index += 1) {
    if (a[index] !== b[index]) {
      return false;
    }
  }

  return true;
}

async function getFeedFolderIdsForUser(params: {
  userId: string;
  feedId: string;
  legacyFolderId: string | null;
}): Promise<string[]> {
  let memberships: Array<{ folderId: string }> = [];

  try {
    memberships = await db.query.feedFolderMemberships.findMany({
      where: and(
        eq(feedFolderMemberships.userId, params.userId),
        eq(feedFolderMemberships.feedId, params.feedId)
      ),
      columns: { folderId: true },
    });
  } catch (error) {
    if (!isMissingRelationError(error, "feed_folder_memberships")) {
      throw error;
    }
  }

  return resolveFeedFolderIds({
    legacyFolderId: params.legacyFolderId,
    membershipFolderIds: memberships.map((membership) => membership.folderId),
  });
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
    async resolveFolderIds(folderNames: string[]): Promise<string[]> {
      const resolvedFolderIds: string[] = [];

      for (const folderName of folderNames) {
        const resolvedFolderId = await ensureFolderId(folderName);
        if (resolvedFolderId) {
          resolvedFolderIds.push(resolvedFolderId);
        }
      }

      return normalizeFolderIds(resolvedFolderIds);
    },
  };
}

function mapFailureFromFeedError(error: unknown): Pick<FeedImportRowResult, "code" | "message"> {
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
  existingFeed:
    | NonNullable<Awaited<ReturnType<typeof findExistingFeedForUserByUrl>>>
    | null;
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

  const existingFolderIds = normalizeFolderIds(
    await getFeedFolderIdsForUser({
      userId: params.userId,
      feedId: params.existingFeed.id,
      legacyFolderId: params.existingFeed.folderId,
    })
  );

  const mergedFolderIds = normalizeFolderIds([
    ...existingFolderIds,
    ...params.resolvedFolderIds,
  ]);

  if (areSortedStringListsEqual(existingFolderIds, mergedFolderIds)) {
    return {
      url: params.importUrl,
      status: "duplicate_unchanged",
      code: "duplicate",
      feedId: params.existingFeed.id,
      message: "This feed is already in your library.",
    };
  }

  const folderUpdateResult = await setFeedFoldersForUser(
    params.userId,
    params.existingFeed.id,
    mergedFolderIds
  );

  if (folderUpdateResult.status !== "ok") {
    return {
      url: params.importUrl,
      status: "failed",
      code: "unknown",
      message: "Could not merge imported folder assignments.",
      feedId: params.existingFeed.id,
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
}):
  Promise<
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
  const directExistingFeed = await findExistingFeedForUserByUrl(
    params.userId,
    params.normalizedInputUrl
  );

  if (directExistingFeed) {
    return {
      status: "candidate",
      candidate: {
        url: params.normalizedInputUrl,
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
    const parsedDirectFeed = await parseFeedWithMetadata(params.normalizedInputUrl);
    const resolvedExistingFeed = await findExistingFeedForUserByUrl(
      params.userId,
      parsedDirectFeed.resolvedUrl
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
      return {
        status: "failed",
        code: mappedFailure.code,
        message: mappedFailure.message || "Could not import this feed.",
      };
    }
  }

  const discovery = await discoverFeedCandidates(params.normalizedInputUrl);
  const validatedCandidates: ImportCandidate[] = [];

  for (const discoveredUrl of discovery.candidates) {
    try {
      const parsedCandidateFeed = await parseFeedWithMetadata(discoveredUrl);
      const existingFeed = await findExistingFeedForUserByUrl(
        params.userId,
        parsedCandidateFeed.resolvedUrl
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
    return {
      status: "failed",
      code: "invalid_xml",
      message: NO_FEED_FOUND_MESSAGE,
    };
  }

  const addableCandidates = validatedCandidates.filter(
    (candidate) => !candidate.existingFeed
  );
  const duplicateCandidates = validatedCandidates.filter(
    (candidate) => candidate.existingFeed
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
}): Promise<FeedImportRowResult> {
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

  const candidate = candidateResult.candidate;
  const resolvedFolderIds = await params.folderResolver.resolveFolderIds(
    params.entry.folderNames
  );

  if (candidate.existingFeed) {
    return await mergeDuplicateFeedFolders({
      userId: params.userId,
      importUrl: normalizedInputUrl,
      existingFeed: candidate.existingFeed,
      resolvedFolderIds,
    });
  }

  try {
    const created = await createFeedWithInitialItems(
      params.userId,
      candidate.url,
      candidate.parsedFeed,
      resolvedFolderIds,
      {
        etag: candidate.etag,
        lastModified: candidate.lastModified,
      }
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
    };
  } catch (error) {
    const raceDuplicate = await findExistingFeedForUserByUrl(
      params.userId,
      candidate.url
    );

    if (raceDuplicate) {
      return await mergeDuplicateFeedFolders({
        userId: params.userId,
        importUrl: normalizedInputUrl,
        existingFeed: raceDuplicate,
        resolvedFolderIds,
      });
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
}): Promise<FeedImportRowResult[]> {
  if (params.entries.length === 0) {
    return [];
  }

  const skipMultiCandidate = params.skipMultiCandidate !== false;
  const folderResolver = await createFolderResolver(params.userId);
  const workerCount = Math.max(
    1,
    Math.min(IMPORT_WORKER_CONCURRENCY, params.entries.length)
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
        results[nextIndex] = await importOneFeedEntry({
          userId: params.userId,
          entry,
          skipMultiCandidate,
          folderResolver,
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
