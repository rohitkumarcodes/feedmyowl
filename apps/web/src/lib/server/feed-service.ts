import "server-only";

import {
  and,
  db,
  eq,
  feedFolderMemberships,
  feedItems,
  feeds,
  folders,
  inArray,
  isNull,
  not,
  sql,
} from "@/lib/server/database";
import { computeFeedItemFingerprint } from "@/lib/server/feed-item-fingerprint";
import { captureError } from "@/lib/server/error-tracking";
import { normalizeFeedError } from "@/lib/shared/feed-errors";
import { parseFeedWithCache, type ParsedFeed } from "@/lib/server/feed-parser";
import { normalizeFolderIds } from "@/lib/shared/folder-memberships";
import { purgeOldFeedItemsForFeed, purgeOldFeedItems } from "@/lib/server/retention";

export interface RefreshResult {
  feedId: string;
  feedUrl: string;
  newItemCount: number;
  status: "success" | "error";
  fetchState?: "updated" | "not_modified";
  errorCode?: string;
  errorMessage?: string;
}

interface FeedHttpValidators {
  etag?: string | null;
  lastModified?: string | null;
}

function toInsertableFeedItemRows(feedId: string, parsedFeed: ParsedFeed) {
  return parsedFeed.items.map((item) => {
    const guid = item.guid ?? null;

    return {
      feedId,
      guid,
      title: item.title,
      link: item.link,
      content: item.content,
      author: item.author,
      publishedAt: item.publishedAt,
      contentFingerprint: guid
        ? null
        : computeFeedItemFingerprint({
            link: item.link,
            title: item.title,
            content: item.content,
            author: item.author,
            publishedAt: item.publishedAt,
          }),
    };
  });
}

async function insertParsedFeedItems(
  feedId: string,
  parsedFeed: ParsedFeed,
): Promise<number> {
  const rows = toInsertableFeedItemRows(feedId, parsedFeed);

  if (rows.length === 0) {
    return 0;
  }

  const insertedRows = await db
    .insert(feedItems)
    .values(rows)
    .onConflictDoNothing()
    .returning({ id: feedItems.id });

  return insertedRows.length;
}

/**
 * Look up an existing feed by normalized URL.
 */
export async function findExistingFeedByUrl(url: string) {
  return await db.query.feeds.findFirst({
    where: eq(feeds.url, url),
  });
}

/**
 * Create a feed row and insert initial parsed items.
 */
export async function createFeedWithInitialItems(
  url: string,
  parsedFeed: ParsedFeed,
  folderIds: string[] = [],
  httpValidators: FeedHttpValidators = {},
) {
  const now = new Date();
  const normalizedFolderIds = normalizeFolderIds(folderIds);

  const [newFeed] = await db
    .insert(feeds)
    .values({
      url,
      title: parsedFeed.title || null,
      description: parsedFeed.description || null,
      lastFetchedAt: now,
      lastFetchStatus: "success",
      lastFetchErrorCode: null,
      lastFetchErrorMessage: null,
      lastFetchErrorAt: null,
      httpEtag: httpValidators.etag ?? null,
      httpLastModified: httpValidators.lastModified ?? null,
      updatedAt: now,
    })
    .returning();

  const insertedItems = await insertParsedFeedItems(newFeed.id, parsedFeed);

  await purgeOldFeedItemsForFeed({ feedId: newFeed.id });

  if (normalizedFolderIds.length > 0) {
    await db.insert(feedFolderMemberships).values(
      normalizedFolderIds.map((folderId) => ({
        feedId: newFeed.id,
        folderId,
        createdAt: now,
        updatedAt: now,
      })),
    );
  }

  return { feed: newFeed, insertedItems };
}

export type MarkItemReadResult =
  | { status: "not_found" }
  | { status: "already_read"; itemId: string; readAt: string }
  | { status: "marked"; itemId: string; readAt: string };

/**
 * Mark one feed item as read.
 */
export async function markFeedItemRead(itemId: string): Promise<MarkItemReadResult> {
  const item = await db.query.feedItems.findFirst({
    where: eq(feedItems.id, itemId),
    columns: {
      id: true,
      readAt: true,
    },
  });

  if (!item) {
    return { status: "not_found" };
  }

  if (item.readAt) {
    return {
      status: "already_read",
      itemId: item.id,
      readAt: item.readAt.toISOString(),
    };
  }

  const now = new Date();
  await db
    .update(feedItems)
    .set({ readAt: now, updatedAt: now })
    .where(eq(feedItems.id, item.id));

  return {
    status: "marked",
    itemId: item.id,
    readAt: now.toISOString(),
  };
}

export type SetItemSavedResult =
  | { status: "not_found" }
  | { status: "already_set"; itemId: string; savedAt: string | null }
  | { status: "updated"; itemId: string; savedAt: string | null };

/**
 * Set saved/bookmarked state on one feed item.
 */
export async function setFeedItemSaved(
  itemId: string,
  saved: boolean,
): Promise<SetItemSavedResult> {
  const item = await db.query.feedItems.findFirst({
    where: eq(feedItems.id, itemId),
    columns: {
      id: true,
      savedAt: true,
    },
  });

  if (!item) {
    return { status: "not_found" };
  }

  const isSaved = Boolean(item.savedAt);
  if (saved === isSaved) {
    return {
      status: "already_set",
      itemId: item.id,
      savedAt: item.savedAt ? item.savedAt.toISOString() : null,
    };
  }

  const now = new Date();
  const nextSavedAt = saved ? now : null;

  await db
    .update(feedItems)
    .set({ savedAt: nextSavedAt, updatedAt: now })
    .where(eq(feedItems.id, item.id));

  return {
    status: "updated",
    itemId: item.id,
    savedAt: saved ? now.toISOString() : null,
  };
}

export type RefreshAllFeedsResult = {
  status: "ok";
  /** Rows pruned by count-cap retention during this refresh flow. */
  retentionDeletedCount: number;
  message?: string;
  results: RefreshResult[];
};

/**
 * Refresh all feeds and insert new items.
 */
export async function refreshAllFeeds(): Promise<RefreshAllFeedsResult> {
  let retentionDeletedCount = await purgeOldFeedItems();

  const allFeeds = await db.query.feeds.findMany();

  if (allFeeds.length === 0) {
    return {
      status: "ok",
      message: "No feeds to refresh",
      results: [],
      retentionDeletedCount,
    };
  }

  const settledResults = await Promise.allSettled(
    allFeeds.map(
      async (feed): Promise<{ result: RefreshResult; prunedCount: number }> => {
        try {
          const parsedResult = await parseFeedWithCache(feed.url, {
            etag: feed.httpEtag,
            lastModified: feed.httpLastModified,
          });
          const now = new Date();

          if (parsedResult.status === "not_modified") {
            await db
              .update(feeds)
              .set({
                lastFetchedAt: now,
                lastFetchStatus: "success",
                lastFetchErrorCode: null,
                lastFetchErrorMessage: null,
                lastFetchErrorAt: null,
                httpEtag: parsedResult.etag ?? feed.httpEtag,
                httpLastModified: parsedResult.lastModified ?? feed.httpLastModified,
                updatedAt: now,
              })
              .where(eq(feeds.id, feed.id));

            return {
              result: {
                feedId: feed.id,
                feedUrl: feed.url,
                newItemCount: 0,
                status: "success",
                fetchState: "not_modified",
              },
              prunedCount: 0,
            };
          }

          await db
            .update(feeds)
            .set({
              title: parsedResult.parsedFeed.title || feed.title,
              description: parsedResult.parsedFeed.description || feed.description,
              lastFetchedAt: now,
              lastFetchStatus: "success",
              lastFetchErrorCode: null,
              lastFetchErrorMessage: null,
              lastFetchErrorAt: null,
              httpEtag: parsedResult.etag,
              httpLastModified: parsedResult.lastModified,
              updatedAt: now,
            })
            .where(eq(feeds.id, feed.id));

          const insertedItemCount = await insertParsedFeedItems(
            feed.id,
            parsedResult.parsedFeed,
          );

          let prunedCount = 0;
          if (insertedItemCount > 0) {
            prunedCount = await purgeOldFeedItemsForFeed({
              feedId: feed.id,
            });
          }

          return {
            result: {
              feedId: feed.id,
              feedUrl: feed.url,
              newItemCount: insertedItemCount,
              status: "success",
              fetchState: "updated",
            },
            prunedCount,
          };
        } catch (error) {
          const normalizedError = normalizeFeedError(error, "refresh");
          const now = new Date();

          await db
            .update(feeds)
            .set({
              lastFetchStatus: "error",
              lastFetchErrorCode: normalizedError.code,
              lastFetchErrorMessage: normalizedError.message,
              lastFetchErrorAt: now,
              updatedAt: now,
            })
            .where(eq(feeds.id, feed.id));

          captureError(error, {
            feedId: feed.id,
            feedUrl: feed.url,
            code: normalizedError.code,
          });

          return {
            result: {
              feedId: feed.id,
              feedUrl: feed.url,
              newItemCount: 0,
              status: "error",
              errorCode: normalizedError.code,
              errorMessage: normalizedError.message,
            },
            prunedCount: 0,
          };
        }
      },
    ),
  );

  const refreshResults: RefreshResult[] = settledResults.map((result) => {
    if (result.status === "fulfilled") {
      retentionDeletedCount += result.value.prunedCount;
      return result.value.result;
    }

    return {
      feedId: "unknown",
      feedUrl: "unknown",
      newItemCount: 0,
      status: "error",
      errorCode: "refresh_failed",
      errorMessage: "Feed refresh failed.",
    };
  });

  return {
    status: "ok",
    results: refreshResults,
    retentionDeletedCount,
  };
}

/**
 * Delete one feed.
 */
export async function deleteFeed(feedId: string): Promise<boolean> {
  const deleted = await db.delete(feeds).where(eq(feeds.id, feedId)).returning();

  return deleted.length > 0;
}

/**
 * Delete all uncategorized feeds (feeds without folder memberships).
 */
export async function deleteUncategorizedFeeds(): Promise<number> {
  const allFeeds = await db.query.feeds.findMany({
    columns: { id: true },
  });

  if (allFeeds.length === 0) {
    return 0;
  }

  const allFeedIds = allFeeds.map((feed) => feed.id);

  const memberships = await db.query.feedFolderMemberships.findMany({
    where: inArray(feedFolderMemberships.feedId, allFeedIds),
    columns: { feedId: true },
  });

  const categorizedFeedIds = new Set(memberships.map((membership) => membership.feedId));
  const uncategorizedFeedIds = allFeedIds.filter(
    (feedId) => !categorizedFeedIds.has(feedId),
  );

  if (uncategorizedFeedIds.length === 0) {
    return 0;
  }

  const deletedFeeds = await db
    .delete(feeds)
    .where(inArray(feeds.id, uncategorizedFeedIds))
    .returning({ id: feeds.id });

  return deletedFeeds.length;
}

export type MoveUncategorizedFeedsToFolderResult =
  | { status: "invalid_folder_id" }
  | {
      status: "ok";
      totalUncategorizedCount: number;
      movedFeedCount: number;
      failedFeedCount: number;
    };

/**
 * Assign all currently uncategorized feeds to one folder.
 *
 * Best effort: each feed assignment is attempted independently. Failures are
 * counted and surfaced to the caller while successful moves are preserved.
 */
export async function moveUncategorizedFeedsToFolder(
  folderId: string,
): Promise<MoveUncategorizedFeedsToFolderResult> {
  const targetFolder = await db.query.folders.findFirst({
    where: eq(folders.id, folderId),
    columns: { id: true },
  });

  if (!targetFolder) {
    return { status: "invalid_folder_id" };
  }

  const allFeeds = await db.query.feeds.findMany({
    columns: { id: true },
  });

  if (allFeeds.length === 0) {
    return {
      status: "ok",
      totalUncategorizedCount: 0,
      movedFeedCount: 0,
      failedFeedCount: 0,
    };
  }

  const allFeedIds = allFeeds.map((feed) => feed.id);
  const memberships = await db.query.feedFolderMemberships.findMany({
    where: inArray(feedFolderMemberships.feedId, allFeedIds),
    columns: { feedId: true },
  });

  const categorizedFeedIds = new Set(memberships.map((membership) => membership.feedId));
  const uncategorizedFeedIds = allFeedIds.filter(
    (feedId) => !categorizedFeedIds.has(feedId),
  );

  if (uncategorizedFeedIds.length === 0) {
    return {
      status: "ok",
      totalUncategorizedCount: 0,
      movedFeedCount: 0,
      failedFeedCount: 0,
    };
  }

  const now = new Date();
  const settledMoves = await Promise.allSettled(
    uncategorizedFeedIds.map(async (feedId) => {
      await db.insert(feedFolderMemberships).values({
        feedId,
        folderId,
        createdAt: now,
        updatedAt: now,
      });

      return feedId;
    }),
  );

  const movedFeedIds: string[] = [];
  let failedFeedCount = 0;

  for (const result of settledMoves) {
    if (result.status === "fulfilled") {
      movedFeedIds.push(result.value);
      continue;
    }

    failedFeedCount += 1;
  }

  if (movedFeedIds.length > 0) {
    await db.update(feeds).set({ updatedAt: now }).where(inArray(feeds.id, movedFeedIds));
  }

  return {
    status: "ok",
    totalUncategorizedCount: uncategorizedFeedIds.length,
    movedFeedCount: movedFeedIds.length,
    failedFeedCount,
  };
}

/**
 * Update the display name for one feed.
 */
export async function renameFeed(feedId: string, customTitle: string | null) {
  const now = new Date();
  const [updatedFeed] = await db
    .update(feeds)
    .set({
      customTitle,
      updatedAt: now,
    })
    .where(eq(feeds.id, feedId))
    .returning({
      id: feeds.id,
      url: feeds.url,
      title: feeds.title,
      customTitle: feeds.customTitle,
      updatedAt: feeds.updatedAt,
    });

  return updatedFeed || null;
}

export type SetFeedFoldersResult =
  | { status: "feed_not_found" }
  | { status: "invalid_folder_ids"; invalidFolderIds: string[] }
  | { status: "ok"; folderIds: string[] };

export type AddFeedFoldersResult =
  | { status: "feed_not_found" }
  | { status: "invalid_folder_ids"; invalidFolderIds: string[] }
  | { status: "ok"; addedFolderIds: string[]; folderIds: string[] };

/**
 * Add folder memberships for one feed without removing existing assignments.
 */
export async function addFeedFolders(
  feedId: string,
  folderIds: string[],
): Promise<AddFeedFoldersResult> {
  const normalizedFolderIds = normalizeFolderIds(folderIds);

  const feed = await db.query.feeds.findFirst({
    where: eq(feeds.id, feedId),
    columns: { id: true },
  });

  if (!feed) {
    return { status: "feed_not_found" };
  }

  if (normalizedFolderIds.length === 0) {
    const currentMemberships = await db.query.feedFolderMemberships.findMany({
      where: eq(feedFolderMemberships.feedId, feedId),
      columns: { folderId: true },
    });

    return {
      status: "ok",
      addedFolderIds: [],
      folderIds: normalizeFolderIds(
        currentMemberships.map((membership) => membership.folderId),
      ),
    };
  }

  const availableFolders = await db.query.folders.findMany({
    where: inArray(folders.id, normalizedFolderIds),
    columns: { id: true },
  });

  const availableFolderIds = new Set(availableFolders.map((folder) => folder.id));
  const invalidFolderIds = normalizedFolderIds.filter(
    (folderId) => !availableFolderIds.has(folderId),
  );

  if (invalidFolderIds.length > 0) {
    return { status: "invalid_folder_ids", invalidFolderIds };
  }

  const now = new Date();
  const insertedMemberships = await db
    .insert(feedFolderMemberships)
    .values(
      normalizedFolderIds.map((folderId) => ({
        feedId,
        folderId,
        createdAt: now,
        updatedAt: now,
      })),
    )
    .onConflictDoNothing()
    .returning({ folderId: feedFolderMemberships.folderId });

  if (insertedMemberships.length > 0) {
    await db.update(feeds).set({ updatedAt: now }).where(eq(feeds.id, feedId));
  }

  const currentMemberships = await db.query.feedFolderMemberships.findMany({
    where: eq(feedFolderMemberships.feedId, feedId),
    columns: { folderId: true },
  });

  return {
    status: "ok",
    addedFolderIds: normalizeFolderIds(
      insertedMemberships.map((membership) => membership.folderId),
    ),
    folderIds: normalizeFolderIds(
      currentMemberships.map((membership) => membership.folderId),
    ),
  };
}

/**
 * Replace folder memberships for one feed.
 */
export async function setFeedFolders(
  feedId: string,
  folderIds: string[],
): Promise<SetFeedFoldersResult> {
  const normalizedFolderIds = normalizeFolderIds(folderIds);

  const feed = await db.query.feeds.findFirst({
    where: eq(feeds.id, feedId),
    columns: { id: true },
  });

  if (!feed) {
    return { status: "feed_not_found" };
  }

  if (normalizedFolderIds.length > 0) {
    const availableFolders = await db.query.folders.findMany({
      where: inArray(folders.id, normalizedFolderIds),
      columns: { id: true },
    });

    const availableFolderIds = new Set(availableFolders.map((folder) => folder.id));
    const invalidFolderIds = normalizedFolderIds.filter(
      (folderId) => !availableFolderIds.has(folderId),
    );

    if (invalidFolderIds.length > 0) {
      return { status: "invalid_folder_ids", invalidFolderIds };
    }
  }

  const now = new Date();

  // neon-http does not support db.transaction(), so we use an
  // insert-first-then-delete pattern to avoid a window where memberships are
  // missing. The unique constraint on (feedId, folderId) ensures
  // onConflictDoNothing is safe for already-existing memberships.
  if (normalizedFolderIds.length > 0) {
    await db
      .insert(feedFolderMemberships)
      .values(
        normalizedFolderIds.map((folderId) => ({
          feedId,
          folderId,
          createdAt: now,
          updatedAt: now,
        })),
      )
      .onConflictDoNothing();
  }

  // Remove memberships that are no longer desired.
  if (normalizedFolderIds.length > 0) {
    await db
      .delete(feedFolderMemberships)
      .where(
        and(
          eq(feedFolderMemberships.feedId, feedId),
          not(inArray(feedFolderMemberships.folderId, normalizedFolderIds)),
        ),
      );
  } else {
    // Remove all memberships for this feed.
    await db
      .delete(feedFolderMemberships)
      .where(eq(feedFolderMemberships.feedId, feedId));
  }

  await db.update(feeds).set({ updatedAt: now }).where(eq(feeds.id, feedId));

  return { status: "ok", folderIds: normalizedFolderIds };
}

export type MarkAllReadScope =
  | { type: "all" }
  | { type: "unread" }
  | { type: "saved" }
  | { type: "uncategorized" }
  | { type: "folder"; id: string }
  | { type: "feed"; id: string };

export type MarkAllFeedItemsReadResult =
  | { status: "ok"; markedCount: number }
  | { status: "scope_not_found" };

/**
 * Mark all unread feed items as read, optionally scoped to a
 * specific feed, folder, or the uncategorized group.
 */
export async function markAllFeedItemsRead(
  scope: MarkAllReadScope,
): Promise<MarkAllFeedItemsReadResult> {
  /* Resolve which feedIds are affected by this scope. */
  let targetFeedIds: string[];

  if (scope.type === "all" || scope.type === "unread" || scope.type === "saved") {
    const allFeeds = await db.query.feeds.findMany({
      columns: { id: true },
    });
    targetFeedIds = allFeeds.map((feed) => feed.id);
  } else if (scope.type === "feed") {
    const feed = await db.query.feeds.findFirst({
      where: eq(feeds.id, scope.id),
      columns: { id: true },
    });
    if (!feed) {
      return { status: "scope_not_found" };
    }
    targetFeedIds = [feed.id];
  } else if (scope.type === "folder") {
    const folder = await db.query.folders.findFirst({
      where: eq(folders.id, scope.id),
      columns: { id: true },
    });
    if (!folder) {
      return { status: "scope_not_found" };
    }
    const memberships = await db.query.feedFolderMemberships.findMany({
      where: eq(feedFolderMemberships.folderId, scope.id),
      columns: { feedId: true },
    });
    targetFeedIds = memberships.map((membership) => membership.feedId);
  } else {
    /* uncategorized — feeds with no folder memberships */
    const allFeeds = await db.query.feeds.findMany({
      columns: { id: true },
    });
    const allFeedIds = allFeeds.map((feed) => feed.id);
    if (allFeedIds.length === 0) {
      return { status: "ok", markedCount: 0 };
    }
    const memberships = await db.query.feedFolderMemberships.findMany({
      where: inArray(feedFolderMemberships.feedId, allFeedIds),
      columns: { feedId: true },
    });
    const categorizedFeedIds = new Set(
      memberships.map((membership) => membership.feedId),
    );
    targetFeedIds = allFeedIds.filter((feedId) => !categorizedFeedIds.has(feedId));
  }

  if (targetFeedIds.length === 0) {
    return { status: "ok", markedCount: 0 };
  }

  const now = new Date();
  const baseWhere = and(
    inArray(feedItems.feedId, targetFeedIds),
    isNull(feedItems.readAt),
  );
  const whereClause =
    scope.type === "saved"
      ? and(baseWhere, sql`${feedItems.savedAt} is not null`)
      : baseWhere;

  const updated = await db
    .update(feedItems)
    .set({ readAt: now, updatedAt: now })
    .where(whereClause)
    .returning({ id: feedItems.id });

  return { status: "ok", markedCount: updated.length };
}
