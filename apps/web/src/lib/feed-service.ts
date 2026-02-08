import { and, db, eq, feedItems, feeds, users } from "@/lib/database";
import { captureError } from "@/lib/error-tracking";
import { normalizeFeedError } from "@/lib/feed-errors";
import { parseFeed, type ParsedFeed } from "@/lib/feed-parser";
import { purgeOldFeedItemsForUser } from "@/lib/retention";

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
  parsedFeed: ParsedFeed
) {
  const now = new Date();

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
  const retentionDeletedCount = await purgeOldFeedItemsForUser(userId);

  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
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
    user.feeds.map(async (feed): Promise<RefreshResult> => {
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
        }

        return {
          feedId: feed.id,
          feedUrl: feed.url,
          newItemCount: insertableItems.length,
          status: "success",
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
          feedId: feed.id,
          feedUrl: feed.url,
          newItemCount: 0,
          status: "error",
          errorCode: normalizedError.code,
          errorMessage: normalizedError.message,
        };
      }
    })
  );

  const refreshResults: RefreshResult[] = settledResults.map((result) =>
    result.status === "fulfilled"
      ? result.value
      : {
          feedId: "unknown",
          feedUrl: "unknown",
          newItemCount: 0,
          status: "error",
          errorCode: "refresh_failed",
          errorMessage: "Feed refresh failed.",
        }
  );

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
