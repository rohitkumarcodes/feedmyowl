/**
 * Module: Feed Item Retention
 *
 * FeedMyOwl keeps a bounded in-app article history.
 * This helper enforces a per-feed count limit and purges
 * older ranked items for a specific user.
 */

import { db, sql } from "@/lib/database";

/** The product-defined max retained item count per feed. */
export const FEED_ITEMS_PER_FEED_LIMIT = 50;

type DeleteResult = {
  rows?: Array<{ id: string }>;
  rowCount?: number;
} | Array<{ id: string }>;

function getDeletedCount(result: DeleteResult): number {
  if (Array.isArray(result)) {
    return result.length;
  }

  if (Array.isArray(result.rows)) {
    return result.rows.length;
  }

  if (typeof result.rowCount === "number") {
    return result.rowCount;
  }

  return 0;
}

/**
 * Delete items outside the per-feed retention cap across all feeds for one user.
 *
 * @param userId - Internal FeedMyOwl user UUID
 * @returns Number of rows deleted
 */
export async function purgeOldFeedItemsForUser(userId: string): Promise<number> {
  const deleted = (await db.execute(sql`
    WITH ranked_items AS (
      SELECT
        fi.id,
        ROW_NUMBER() OVER (
          PARTITION BY fi.feed_id
          ORDER BY COALESCE(fi.published_at, fi.created_at) DESC, fi.id DESC
        ) AS item_rank
      FROM feed_items fi
      INNER JOIN feeds f ON f.id = fi.feed_id
      WHERE f.user_id = ${userId}
    ),
    to_delete AS (
      SELECT id
      FROM ranked_items
      WHERE item_rank > ${FEED_ITEMS_PER_FEED_LIMIT}
    )
    DELETE FROM feed_items
    WHERE id IN (SELECT id FROM to_delete)
    RETURNING id
  `)) as DeleteResult;

  return getDeletedCount(deleted);
}

/**
 * Delete items outside the per-feed retention cap for one feed owned by one user.
 *
 * @param userId - Internal FeedMyOwl user UUID
 * @param feedId - Feed UUID that must belong to the user
 * @returns Number of rows deleted
 */
export async function purgeOldFeedItemsForFeed(params: {
  userId: string;
  feedId: string;
}): Promise<number> {
  const deleted = (await db.execute(sql`
    WITH ranked_items AS (
      SELECT
        fi.id,
        ROW_NUMBER() OVER (
          PARTITION BY fi.feed_id
          ORDER BY COALESCE(fi.published_at, fi.created_at) DESC, fi.id DESC
        ) AS item_rank
      FROM feed_items fi
      INNER JOIN feeds f ON f.id = fi.feed_id
      WHERE f.user_id = ${params.userId}
        AND fi.feed_id = ${params.feedId}
    ),
    to_delete AS (
      SELECT id
      FROM ranked_items
      WHERE item_rank > ${FEED_ITEMS_PER_FEED_LIMIT}
    )
    DELETE FROM feed_items
    WHERE id IN (SELECT id FROM to_delete)
    RETURNING id
  `)) as DeleteResult;

  return getDeletedCount(deleted);
}
