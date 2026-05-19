import "server-only";

/**
 * Module: Feed Item Retention
 *
 * FeedMyOwl keeps a bounded in-app article history.
 * This helper enforces a per-feed count limit and purges
 * older ranked items across all feeds.
 */

import { db, sql } from "@/lib/server/database";

/** The product-defined max retained item count per feed. */
export const FEED_ITEMS_PER_FEED_LIMIT = 50;

type DeleteResult =
  | {
      rows?: Array<{ id: string }>;
      rowCount?: number;
    }
  | Array<{ id: string }>;

type QueryResult =
  | {
      rows?: Array<Record<string, unknown>>;
      rowCount?: number;
    }
  | Array<Record<string, unknown>>;

function getResultRowCount(result: QueryResult): number {
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
 * Delete items outside the per-feed retention cap across all feeds.
 *
 * @returns Number of rows deleted
 */
/**
 * Return true when at least one feed currently exceeds the retention cap.
 */
export async function isRetentionPurgeNeeded(): Promise<boolean> {
  const overLimitFeed = (await db.execute(sql`
    SELECT 1
    FROM feed_items fi
    INNER JOIN feeds f ON f.id = fi.feed_id
    WHERE fi.saved_at IS NULL
    GROUP BY fi.feed_id
    HAVING COUNT(*) > ${FEED_ITEMS_PER_FEED_LIMIT}
    LIMIT 1
  `)) as QueryResult;

  return getResultRowCount(overLimitFeed) > 0;
}

/**
 * Delete items outside the per-feed retention cap for one feed.
 */
export async function purgeOldFeedItemsForFeed(params: {
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
      WHERE fi.feed_id = ${params.feedId}
        AND fi.saved_at IS NULL
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

  return getResultRowCount(deleted);
}

export async function purgeOldFeedItems(): Promise<number> {
  const deleted = (await db.execute(sql`
    WITH ranked_items AS (
      SELECT
        fi.id,
        ROW_NUMBER() OVER (
          PARTITION BY fi.feed_id
          ORDER BY COALESCE(fi.published_at, fi.created_at) DESC, fi.id DESC
        ) AS item_rank
      FROM feed_items fi
      WHERE fi.saved_at IS NULL
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

  return getResultRowCount(deleted);
}
