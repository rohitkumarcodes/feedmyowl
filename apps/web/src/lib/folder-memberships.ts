/**
 * Helpers for deriving normalized feed folder assignments from
 * feed_folder_memberships rows.
 */

/**
 * Build a normalized folder-id list for one feed.
 */
export function resolveFeedFolderIds(membershipFolderIds: string[]): string[] {
  return normalizeFolderIds(membershipFolderIds);
}

/**
 * Build a sorted, normalized folder-id list with stable ordering.
 */
export function normalizeFolderIds(folderIds: string[]): string[] {
  const deduped = new Set<string>();

  for (const folderId of folderIds) {
    const trimmed = folderId.trim();
    if (trimmed) {
      deduped.add(trimmed);
    }
  }

  return [...deduped].sort((a, b) => a.localeCompare(b));
}

export function getFeedMembershipFolderIds(feed: {
  folderMemberships?: Array<{ folderId: string }>;
}): string[] {
  if (!Array.isArray(feed.folderMemberships)) {
    return [];
  }

  return feed.folderMemberships.map((membership) => membership.folderId);
}
