/**
 * Module: Feed Item Retention
 *
 * FeedMyOwl keeps recent reading material, not a permanent archive.
 * This helper centralizes the 90-day retention window and purges
 * stale feed items for a specific user.
 */

import { and, db, eq, feedItems, feeds, inArray, lt } from "@/lib/database";

/** The product-defined retention window for feed items. */
export const FEED_ITEM_RETENTION_DAYS = 90;

/**
 * Build the cutoff timestamp for retention checks.
 *
 * @param now - Optional current time used for deterministic testing
 */
export function getFeedItemRetentionCutoff(now = new Date()): Date {
  const cutoff = new Date(now);
  cutoff.setDate(cutoff.getDate() - FEED_ITEM_RETENTION_DAYS);
  return cutoff;
}

/**
 * Delete feed items older than the retention cutoff for one user.
 *
 * @param userId - Internal FeedMyOwl user UUID
 * @returns Number of rows deleted
 */
export async function purgeOldFeedItemsForUser(userId: string): Promise<number> {
  const ownedFeeds = await db.query.feeds.findMany({
    where: eq(feeds.userId, userId),
    columns: { id: true },
  });

  if (ownedFeeds.length === 0) {
    return 0;
  }

  const ownedFeedIds = ownedFeeds.map((feed) => feed.id);
  const cutoff = getFeedItemRetentionCutoff();

  const deletedRows = await db
    .delete(feedItems)
    .where(
      and(
        inArray(feedItems.feedId, ownedFeedIds),
        lt(feedItems.createdAt, cutoff)
      )
    )
    .returning({ id: feedItems.id });

  return deletedRows.length;
}
