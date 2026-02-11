import {
  and,
  db,
  eq,
  feedFolderMemberships,
  feedItems,
  feeds,
  folders,
  inArray,
  users,
} from "@/lib/database";
import { isMissingRelationError } from "@/lib/db-compat";
import { captureError } from "@/lib/error-tracking";
import { normalizeFeedError } from "@/lib/feed-errors";
import { parseFeed, type ParsedFeed } from "@/lib/feed-parser";
import { normalizeFolderIds } from "@/lib/folder-memberships";
import { purgeOldFeedItemsForFeed, purgeOldFeedItemsForUser } from "@/lib/retention";

export interface RefreshResult {
  feedId: string;
  feedUrl: string;
  newItemCount: number;
  status: "success" | "error";
  errorCode?: string;
  errorMessage?: string;
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
  folderIds: string[] = []
) {
  const now = new Date();
  const normalizedFolderIds = normalizeFolderIds(folderIds);

  const [newFeed] = await db
    .insert(feeds)
    .values({
      userId,
      folderId: normalizedFolderIds[0] ?? null,
      url,
      title: parsedFeed.title || null,
      description: parsedFeed.description || null,
      lastFetchedAt: now,
      lastFetchStatus: "success",
      lastFetchErrorCode: null,
      lastFetchErrorMessage: null,
      lastFetchErrorAt: null,
      updatedAt: now,
    })
    .returning();

  const insertableItems = parsedFeed.items.filter((item) => item.guid);

  if (insertableItems.length > 0) {
    await db.insert(feedItems).values(
      insertableItems.map((item) => ({
        feedId: newFeed.id,
        guid: item.guid,
        title: item.title,
        link: item.link,
        content: item.content,
        author: item.author,
        publishedAt: item.publishedAt,
      }))
    );
  }

  await purgeOldFeedItemsForFeed({ userId, feedId: newFeed.id });

  if (normalizedFolderIds.length > 0) {
    try {
      await db.insert(feedFolderMemberships).values(
        normalizedFolderIds.map((folderId) => ({
          userId,
          feedId: newFeed.id,
          folderId,
          createdAt: now,
          updatedAt: now,
        }))
      );
    } catch (error) {
      if (!isMissingRelationError(error, "feed_folder_memberships")) {
        throw error;
      }
    }
  }

  return { feed: newFeed, insertedItems: insertableItems.length };
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
  itemId: string
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
  userId: string
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
          const parsed = await parseFeed(feed.url);
          const now = new Date();

        await db
          .update(feeds)
          .set({
            title: parsed.title || feed.title,
            description: parsed.description || feed.description,
            lastFetchedAt: now,
            lastFetchStatus: "success",
            lastFetchErrorCode: null,
            lastFetchErrorMessage: null,
            lastFetchErrorAt: null,
            updatedAt: now,
          })
          .where(eq(feeds.id, feed.id));

        const existingItems = await db.query.feedItems.findMany({
          where: eq(feedItems.feedId, feed.id),
          columns: { guid: true },
        });

        const existingGuids = new Set(existingItems.map((item) => item.guid));

        const insertableItems = parsed.items.filter(
          (item) => item.guid && !existingGuids.has(item.guid)
        );

        let prunedCount = 0;

        if (insertableItems.length > 0) {
          await db.insert(feedItems).values(
            insertableItems.map((item) => ({
              feedId: feed.id,
              guid: item.guid,
              title: item.title,
              link: item.link,
              content: item.content,
              author: item.author,
              publishedAt: item.publishedAt,
            }))
          );

          prunedCount = await purgeOldFeedItemsForFeed({
            userId,
            feedId: feed.id,
          });
        }

        return {
          result: {
            feedId: feed.id,
            feedUrl: feed.url,
            newItemCount: insertableItems.length,
            status: "success",
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
    })
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
export async function deleteFeedForUser(userId: string, feedId: string): Promise<boolean> {
  const deleted = await db
    .delete(feeds)
    .where(and(eq(feeds.id, feedId), eq(feeds.userId, userId)))
    .returning();

  return deleted.length > 0;
}

/**
 * Update the user-defined display name for one feed belonging to one user.
 */
export async function renameFeedForUser(
  userId: string,
  feedId: string,
  customTitle: string | null
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

/**
 * Replace folder memberships for one feed belonging to one user.
 */
export async function setFeedFoldersForUser(
  userId: string,
  feedId: string,
  folderIds: string[]
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
      (folderId) => !availableFolderIds.has(folderId)
    );

    if (invalidFolderIds.length > 0) {
      return { status: "invalid_folder_ids", invalidFolderIds };
    }
  }

  const now = new Date();

  try {
    // neon-http does not support db.transaction(); execute writes sequentially.
    await db
      .delete(feedFolderMemberships)
      .where(
        and(
          eq(feedFolderMemberships.userId, userId),
          eq(feedFolderMemberships.feedId, feedId)
        )
      );

    if (normalizedFolderIds.length > 0) {
      await db.insert(feedFolderMemberships).values(
        normalizedFolderIds.map((folderId) => ({
          userId,
          feedId,
          folderId,
          createdAt: now,
          updatedAt: now,
        }))
      );
    }

    await db
      .update(feeds)
      .set({
        // Keep legacy column synced during migration window.
        folderId: normalizedFolderIds[0] ?? null,
        updatedAt: now,
      })
      .where(and(eq(feeds.id, feedId), eq(feeds.userId, userId)));

    return { status: "ok", folderIds: normalizedFolderIds };
  } catch (error) {
    if (!isMissingRelationError(error, "feed_folder_memberships")) {
      throw error;
    }

    const fallbackFolderIds = normalizedFolderIds.slice(0, 1);
    await db
      .update(feeds)
      .set({
        folderId: fallbackFolderIds[0] ?? null,
        updatedAt: now,
      })
      .where(and(eq(feeds.id, feedId), eq(feeds.userId, userId)));

    return { status: "ok", folderIds: fallbackFolderIds };
  }
}
