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
  users,
} from "@/lib/server/database";
import { computeFeedItemFingerprint } from "@/lib/server/feed-item-fingerprint";
import { captureError } from "@/lib/server/error-tracking";
import { normalizeFeedError } from "@/lib/shared/feed-errors";
import { parseFeedWithCache, type ParsedFeed } from "@/lib/server/feed-parser";
import { normalizeFolderIds } from "@/lib/shared/folder-memberships";
import {
  purgeOldFeedItemsForFeed,
  purgeOldFeedItemsForUser,
} from "@/lib/server/retention";

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
 * Look up an existing feed for one user by normalized URL.
 */
export async function findExistingFeedForUserByUrl(userId: string, url: string) {
  return await db.query.feeds.findFirst({
    where: and(eq(feeds.userId, userId), eq(feeds.url, url)),
  });
}

/**
 * Create a feed row and insert initial parsed items.
 */
export async function createFeedWithInitialItems(
  userId: string,
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
      userId,
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

  await purgeOldFeedItemsForFeed({ userId, feedId: newFeed.id });

  if (normalizedFolderIds.length > 0) {
    await db.insert(feedFolderMemberships).values(
      normalizedFolderIds.map((folderId) => ({
        userId,
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
 * Mark one feed item as read for its owner.
 */
export async function markFeedItemReadForUser(
  userId: string,
  itemId: string,
): Promise<MarkItemReadResult> {
  const item = await db.query.feedItems.findFirst({
    where: eq(feedItems.id, itemId),
    with: {
      feed: {
        columns: {
          id: true,
          userId: true,
        },
      },
    },
  });

  if (!item || item.feed.userId !== userId) {
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

export type RefreshFeedsForUserResult =
  | { status: "user_not_found"; retentionDeletedCount: number }
  | {
      status: "ok";
      /** Rows pruned by count-cap retention during this refresh flow. */
      retentionDeletedCount: number;
      message?: string;
      results: RefreshResult[];
    };

/**
 * Refresh all feeds for one user and insert new items.
 */
export async function refreshFeedsForUser(
  userId: string,
): Promise<RefreshFeedsForUserResult> {
  let retentionDeletedCount = await purgeOldFeedItemsForUser(userId);

  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: {
      id: true,
      clerkId: true,
      email: true,
      subscriptionTier: true,
      stripeCustomerId: true,
      stripeSubscriptionId: true,
      createdAt: true,
      updatedAt: true,
    },
    with: { feeds: true },
  });

  if (!user) {
    return {
      status: "user_not_found",
      retentionDeletedCount,
    };
  }

  if (user.feeds.length === 0) {
    return {
      status: "ok",
      message: "No feeds to refresh",
      results: [],
      retentionDeletedCount,
    };
  }

  const settledResults = await Promise.allSettled(
    user.feeds.map(
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
              userId,
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
 * Delete one feed belonging to one user.
 */
export async function deleteFeedForUser(
  userId: string,
  feedId: string,
): Promise<boolean> {
  const deleted = await db
    .delete(feeds)
    .where(and(eq(feeds.id, feedId), eq(feeds.userId, userId)))
    .returning();

  return deleted.length > 0;
}

/**
 * Delete all uncategorized feeds (feeds without folder memberships) for one user.
 */
export async function deleteUncategorizedFeedsForUser(userId: string): Promise<number> {
  const userFeeds = await db.query.feeds.findMany({
    where: eq(feeds.userId, userId),
    columns: { id: true },
  });

  if (userFeeds.length === 0) {
    return 0;
  }

  const userFeedIds = userFeeds.map((feed) => feed.id);

  const memberships = await db.query.feedFolderMemberships.findMany({
    where: and(
      eq(feedFolderMemberships.userId, userId),
      inArray(feedFolderMemberships.feedId, userFeedIds),
    ),
    columns: { feedId: true },
  });

  const categorizedFeedIds = new Set(memberships.map((membership) => membership.feedId));
  const uncategorizedFeedIds = userFeedIds.filter(
    (feedId) => !categorizedFeedIds.has(feedId),
  );

  if (uncategorizedFeedIds.length === 0) {
    return 0;
  }

  const deletedFeeds = await db
    .delete(feeds)
    .where(and(eq(feeds.userId, userId), inArray(feeds.id, uncategorizedFeedIds)))
    .returning({ id: feeds.id });

  return deletedFeeds.length;
}

export type MoveUncategorizedFeedsToFolderForUserResult =
  | { status: "invalid_folder_id" }
  | {
      status: "ok";
      totalUncategorizedCount: number;
      movedFeedCount: number;
      failedFeedCount: number;
    };

/**
 * Assign all currently uncategorized feeds to one folder for one user.
 *
 * Best effort: each feed assignment is attempted independently. Failures are
 * counted and surfaced to the caller while successful moves are preserved.
 */
export async function moveUncategorizedFeedsToFolderForUser(
  userId: string,
  folderId: string,
): Promise<MoveUncategorizedFeedsToFolderForUserResult> {
  const targetFolder = await db.query.folders.findFirst({
    where: and(eq(folders.userId, userId), eq(folders.id, folderId)),
    columns: { id: true },
  });

  if (!targetFolder) {
    return { status: "invalid_folder_id" };
  }

  const userFeeds = await db.query.feeds.findMany({
    where: eq(feeds.userId, userId),
    columns: { id: true },
  });

  if (userFeeds.length === 0) {
    return {
      status: "ok",
      totalUncategorizedCount: 0,
      movedFeedCount: 0,
      failedFeedCount: 0,
    };
  }

  const userFeedIds = userFeeds.map((feed) => feed.id);
  const memberships = await db.query.feedFolderMemberships.findMany({
    where: and(
      eq(feedFolderMemberships.userId, userId),
      inArray(feedFolderMemberships.feedId, userFeedIds),
    ),
    columns: { feedId: true },
  });

  const categorizedFeedIds = new Set(memberships.map((membership) => membership.feedId));
  const uncategorizedFeedIds = userFeedIds.filter(
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
        userId,
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
    await db
      .update(feeds)
      .set({ updatedAt: now })
      .where(and(eq(feeds.userId, userId), inArray(feeds.id, movedFeedIds)));
  }

  return {
    status: "ok",
    totalUncategorizedCount: uncategorizedFeedIds.length,
    movedFeedCount: movedFeedIds.length,
    failedFeedCount,
  };
}

/**
 * Update the user-defined display name for one feed belonging to one user.
 */
export async function renameFeedForUser(
  userId: string,
  feedId: string,
  customTitle: string | null,
) {
  const now = new Date();
  const [updatedFeed] = await db
    .update(feeds)
    .set({
      customTitle,
      updatedAt: now,
    })
    .where(and(eq(feeds.id, feedId), eq(feeds.userId, userId)))
    .returning({
      id: feeds.id,
      url: feeds.url,
      title: feeds.title,
      customTitle: feeds.customTitle,
      updatedAt: feeds.updatedAt,
    });

  return updatedFeed || null;
}

export type SetFeedFoldersForUserResult =
  | { status: "feed_not_found" }
  | { status: "invalid_folder_ids"; invalidFolderIds: string[] }
  | { status: "ok"; folderIds: string[] };

export type AddFeedFoldersForUserResult =
  | { status: "feed_not_found" }
  | { status: "invalid_folder_ids"; invalidFolderIds: string[] }
  | { status: "ok"; addedFolderIds: string[]; folderIds: string[] };

/**
 * Add folder memberships for one feed without removing existing assignments.
 */
export async function addFeedFoldersForUser(
  userId: string,
  feedId: string,
  folderIds: string[],
): Promise<AddFeedFoldersForUserResult> {
  const normalizedFolderIds = normalizeFolderIds(folderIds);

  const feed = await db.query.feeds.findFirst({
    where: and(eq(feeds.id, feedId), eq(feeds.userId, userId)),
    columns: { id: true },
  });

  if (!feed) {
    return { status: "feed_not_found" };
  }

  if (normalizedFolderIds.length === 0) {
    const currentMemberships = await db.query.feedFolderMemberships.findMany({
      where: and(
        eq(feedFolderMemberships.userId, userId),
        eq(feedFolderMemberships.feedId, feedId),
      ),
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
    where: and(eq(folders.userId, userId), inArray(folders.id, normalizedFolderIds)),
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
        userId,
        feedId,
        folderId,
        createdAt: now,
        updatedAt: now,
      })),
    )
    .onConflictDoNothing()
    .returning({ folderId: feedFolderMemberships.folderId });

  if (insertedMemberships.length > 0) {
    await db
      .update(feeds)
      .set({ updatedAt: now })
      .where(and(eq(feeds.id, feedId), eq(feeds.userId, userId)));
  }

  const currentMemberships = await db.query.feedFolderMemberships.findMany({
    where: and(
      eq(feedFolderMemberships.userId, userId),
      eq(feedFolderMemberships.feedId, feedId),
    ),
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
 * Replace folder memberships for one feed belonging to one user.
 */
export async function setFeedFoldersForUser(
  userId: string,
  feedId: string,
  folderIds: string[],
): Promise<SetFeedFoldersForUserResult> {
  const normalizedFolderIds = normalizeFolderIds(folderIds);

  const feed = await db.query.feeds.findFirst({
    where: and(eq(feeds.id, feedId), eq(feeds.userId, userId)),
    columns: { id: true },
  });

  if (!feed) {
    return { status: "feed_not_found" };
  }

  if (normalizedFolderIds.length > 0) {
    const availableFolders = await db.query.folders.findMany({
      where: and(eq(folders.userId, userId), inArray(folders.id, normalizedFolderIds)),
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
  // missing. The unique constraint on (userId, feedId, folderId) ensures
  // onConflictDoNothing is safe for already-existing memberships.
  if (normalizedFolderIds.length > 0) {
    await db
      .insert(feedFolderMemberships)
      .values(
        normalizedFolderIds.map((folderId) => ({
          userId,
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
          eq(feedFolderMemberships.userId, userId),
          eq(feedFolderMemberships.feedId, feedId),
          not(inArray(feedFolderMemberships.folderId, normalizedFolderIds)),
        ),
      );
  } else {
    // User wants zero folders — remove all memberships for this feed.
    await db
      .delete(feedFolderMemberships)
      .where(
        and(
          eq(feedFolderMemberships.userId, userId),
          eq(feedFolderMemberships.feedId, feedId),
        ),
      );
  }

  await db
    .update(feeds)
    .set({ updatedAt: now })
    .where(and(eq(feeds.id, feedId), eq(feeds.userId, userId)));

  return { status: "ok", folderIds: normalizedFolderIds };
}

export type MarkAllReadScope =
  | { type: "all" }
  | { type: "unread" }
  | { type: "uncategorized" }
  | { type: "folder"; id: string }
  | { type: "feed"; id: string };

export type MarkAllFeedItemsReadResult =
  | { status: "ok"; markedCount: number }
  | { status: "scope_not_found" };

/**
 * Mark all unread feed items as read for one user, optionally scoped to a
 * specific feed, folder, or the uncategorized group.
 */
export async function markAllFeedItemsReadForUser(
  userId: string,
  scope: MarkAllReadScope,
): Promise<MarkAllFeedItemsReadResult> {
  /* Resolve which feedIds are affected by this scope. */
  let targetFeedIds: string[];

  if (scope.type === "all" || scope.type === "unread") {
    const userFeeds = await db.query.feeds.findMany({
      where: eq(feeds.userId, userId),
      columns: { id: true },
    });
    targetFeedIds = userFeeds.map((feed) => feed.id);
  } else if (scope.type === "feed") {
    const feed = await db.query.feeds.findFirst({
      where: and(eq(feeds.id, scope.id), eq(feeds.userId, userId)),
      columns: { id: true },
    });
    if (!feed) {
      return { status: "scope_not_found" };
    }
    targetFeedIds = [feed.id];
  } else if (scope.type === "folder") {
    const folder = await db.query.folders.findFirst({
      where: and(eq(folders.id, scope.id), eq(folders.userId, userId)),
      columns: { id: true },
    });
    if (!folder) {
      return { status: "scope_not_found" };
    }
    const memberships = await db.query.feedFolderMemberships.findMany({
      where: and(
        eq(feedFolderMemberships.userId, userId),
        eq(feedFolderMemberships.folderId, scope.id),
      ),
      columns: { feedId: true },
    });
    targetFeedIds = memberships.map((membership) => membership.feedId);
  } else {
    /* uncategorized — feeds with no folder memberships */
    const userFeeds = await db.query.feeds.findMany({
      where: eq(feeds.userId, userId),
      columns: { id: true },
    });
    const userFeedIds = userFeeds.map((feed) => feed.id);
    if (userFeedIds.length === 0) {
      return { status: "ok", markedCount: 0 };
    }
    const memberships = await db.query.feedFolderMemberships.findMany({
      where: and(
        eq(feedFolderMemberships.userId, userId),
        inArray(feedFolderMemberships.feedId, userFeedIds),
      ),
      columns: { feedId: true },
    });
    const categorizedFeedIds = new Set(
      memberships.map((membership) => membership.feedId),
    );
    targetFeedIds = userFeedIds.filter(
      (feedId) => !categorizedFeedIds.has(feedId),
    );
  }

  if (targetFeedIds.length === 0) {
    return { status: "ok", markedCount: 0 };
  }

  const now = new Date();
  const updated = await db
    .update(feedItems)
    .set({ readAt: now, updatedAt: now })
    .where(
      and(inArray(feedItems.feedId, targetFeedIds), isNull(feedItems.readAt)),
    )
    .returning({ id: feedItems.id });

  return { status: "ok", markedCount: updated.length };
}
