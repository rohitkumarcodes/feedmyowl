/**
 * Unread Count Computation
 *
 * Computes unread article counts per feed and per folder from loaded
 * feed data on the client side.  Only used when reading mode is "checker".
 */

import type { FeedViewModel } from "@/features/feeds/types/view-models";

export interface UnreadCounts {
  /** Total unread articles across all feeds. */
  total: number;
  /** Unread count for each individual feed (by feed id). */
  byFeedId: Map<string, number>;
  /** Unread count for each folder (by folder id).  A folder's count
   *  is the sum of its feeds' unread counts. */
  byFolderId: Map<string, number>;
}

/**
 * Iterate all loaded articles in all feeds and count those where
 * `readAt` is null (i.e. unread).  Aggregate totals by feed and folder.
 */
export function computeUnreadCounts(feeds: FeedViewModel[]): UnreadCounts {
  let total = 0;
  const byFeedId = new Map<string, number>();
  const byFolderId = new Map<string, number>();

  for (const feed of feeds) {
    let feedUnread = 0;

    for (const item of feed.items) {
      if (!item.readAt) {
        feedUnread += 1;
      }
    }

    byFeedId.set(feed.id, feedUnread);
    total += feedUnread;

    // Add this feed's unread count to each folder it belongs to.
    for (const folderId of feed.folderIds) {
      byFolderId.set(folderId, (byFolderId.get(folderId) ?? 0) + feedUnread);
    }
  }

  return { total, byFeedId, byFolderId };
}
