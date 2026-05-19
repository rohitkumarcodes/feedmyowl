import "server-only";

import { db, eq, feedFolderMemberships, inArray } from "@/lib/server/database";
import { resolveFeedFolderIds } from "@/lib/shared/folder-memberships";

export async function getFeedFolderIdsForFeed(feedId: string): Promise<string[]> {
  const memberships = await db.query.feedFolderMemberships.findMany({
    where: eq(feedFolderMemberships.feedId, feedId),
    columns: { folderId: true },
  });

  return resolveFeedFolderIds(memberships.map((membership) => membership.folderId));
}

export async function getFeedFolderIdsMapForFeeds(
  feedIds: string[],
): Promise<Map<string, string[]>> {
  if (feedIds.length === 0) {
    return new Map();
  }

  const memberships = await db.query.feedFolderMemberships.findMany({
    where: inArray(feedFolderMemberships.feedId, feedIds),
    columns: {
      feedId: true,
      folderId: true,
    },
  });

  const map = new Map<string, string[]>();
  for (const membership of memberships) {
    const existing = map.get(membership.feedId) ?? [];
    existing.push(membership.folderId);
    map.set(membership.feedId, existing);
  }

  for (const [feedId, folderIds] of map.entries()) {
    map.set(feedId, resolveFeedFolderIds(folderIds));
  }

  return map;
}
