import { and, db, eq, feedFolderMemberships, inArray } from "@/lib/database";
import { resolveFeedFolderIds } from "@/lib/folder-memberships";

export async function getFeedFolderIdsForUserFeed(
  userId: string,
  feedId: string
): Promise<string[]> {
  const memberships = await db.query.feedFolderMemberships.findMany({
    where: and(
      eq(feedFolderMemberships.userId, userId),
      eq(feedFolderMemberships.feedId, feedId)
    ),
    columns: { folderId: true },
  });

  return resolveFeedFolderIds(memberships.map((membership) => membership.folderId));
}

export async function getFeedFolderIdsMapForUserFeeds(params: {
  userId: string;
  feedIds: string[];
}): Promise<Map<string, string[]>> {
  if (params.feedIds.length === 0) {
    return new Map();
  }

  const memberships = await db.query.feedFolderMemberships.findMany({
    where: and(
      eq(feedFolderMemberships.userId, params.userId),
      inArray(feedFolderMemberships.feedId, params.feedIds)
    ),
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
