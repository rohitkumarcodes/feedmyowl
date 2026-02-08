/**
 * Transitional helpers for deriving feed folder assignments while both the
 * legacy feeds.folder_id column and the new membership table coexist.
 */

/**
 * Build a normalized folder-id list for one feed.
 */
export function resolveFeedFolderIds(params: {
  legacyFolderId: string | null;
  membershipFolderIds: string[];
}): string[] {
  const deduped = new Set<string>();

  for (const folderId of params.membershipFolderIds) {
    if (folderId.trim()) {
      deduped.add(folderId);
    }
  }

  if (params.legacyFolderId?.trim()) {
    deduped.add(params.legacyFolderId);
  }

  return [...deduped];
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
