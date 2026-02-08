import {
  and,
  db,
  eq,
  feedFolderMemberships,
  feeds,
  folders,
  inArray,
} from "@/lib/database";
import { isMissingRelationError } from "@/lib/db-compat";
import { normalizeFolderIds, resolveFeedFolderIds } from "@/lib/folder-memberships";

export const FOLDER_NAME_MAX_LENGTH = 255;

export interface FolderRecord {
  id: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
}

export type CreateFolderForUserResult =
  | { status: "invalid_name" }
  | { status: "duplicate_name" }
  | { status: "ok"; folder: FolderRecord };

/**
 * Create one folder for one user.
 */
export async function createFolderForUser(
  userId: string,
  name: string
): Promise<CreateFolderForUserResult> {
  const trimmedName = name.trim();
  if (!trimmedName || trimmedName.length > FOLDER_NAME_MAX_LENGTH) {
    return { status: "invalid_name" };
  }

  const existingFolders = await db.query.folders.findMany({
    where: eq(folders.userId, userId),
    columns: { id: true, name: true },
  });

  const normalizedName = trimmedName.toLocaleLowerCase();
  const hasDuplicate = existingFolders.some(
    (folder) => folder.name.trim().toLocaleLowerCase() === normalizedName
  );

  if (hasDuplicate) {
    return { status: "duplicate_name" };
  }

  const now = new Date();
  const [created] = await db
    .insert(folders)
    .values({
      userId,
      name: trimmedName,
      createdAt: now,
      updatedAt: now,
    })
    .returning({
      id: folders.id,
      name: folders.name,
      createdAt: folders.createdAt,
      updatedAt: folders.updatedAt,
    });

  return { status: "ok", folder: created };
}

export type RenameFolderForUserResult =
  | { status: "invalid_name" }
  | { status: "duplicate_name" }
  | { status: "not_found" }
  | { status: "ok"; folder: FolderRecord };

/**
 * Rename one folder for one user.
 */
export async function renameFolderForUser(
  userId: string,
  folderId: string,
  name: string
): Promise<RenameFolderForUserResult> {
  const trimmedName = name.trim();
  if (!trimmedName || trimmedName.length > FOLDER_NAME_MAX_LENGTH) {
    return { status: "invalid_name" };
  }

  const existingFolder = await db.query.folders.findFirst({
    where: and(eq(folders.id, folderId), eq(folders.userId, userId)),
    columns: { id: true, name: true },
  });

  if (!existingFolder) {
    return { status: "not_found" };
  }

  const siblingFolders = await db.query.folders.findMany({
    where: eq(folders.userId, userId),
    columns: { id: true, name: true },
  });

  const normalizedName = trimmedName.toLocaleLowerCase();
  const hasDuplicate = siblingFolders.some(
    (folder) =>
      folder.id !== folderId &&
      folder.name.trim().toLocaleLowerCase() === normalizedName
  );

  if (hasDuplicate) {
    return { status: "duplicate_name" };
  }

  const now = new Date();
  const [updatedFolder] = await db
    .update(folders)
    .set({
      name: trimmedName,
      updatedAt: now,
    })
    .where(and(eq(folders.id, folderId), eq(folders.userId, userId)))
    .returning({
      id: folders.id,
      name: folders.name,
      createdAt: folders.createdAt,
      updatedAt: folders.updatedAt,
    });

  if (!updatedFolder) {
    return { status: "not_found" };
  }

  return { status: "ok", folder: updatedFolder };
}

export type DeleteFolderMode =
  | "remove_only"
  | "remove_and_unsubscribe_exclusive";

export type DeleteFolderForUserResult =
  | { status: "not_found" }
  | {
      status: "ok";
      mode: DeleteFolderMode;
      totalFeeds: number;
      exclusiveFeeds: number;
      crossListedFeeds: number;
      unsubscribedFeeds: number;
    };

interface FolderMembershipSummary {
  totalFeeds: number;
  exclusiveFeedIds: string[];
  crossListedFeedIds: string[];
  nextLegacyFolderIdByFeedId: Map<string, string | null>;
}

async function buildFolderMembershipSummary(
  userId: string,
  folderId: string
): Promise<FolderMembershipSummary> {
  const userFeeds = await db.query.feeds.findMany({
    where: eq(feeds.userId, userId),
    columns: { id: true, folderId: true },
  });

  let memberships: Array<{ feedId: string; folderId: string }> = [];
  try {
    memberships = await db.query.feedFolderMemberships.findMany({
      where: eq(feedFolderMemberships.userId, userId),
      columns: { feedId: true, folderId: true },
    });
  } catch (error) {
    if (!isMissingRelationError(error, "feed_folder_memberships")) {
      throw error;
    }
  }

  const feedToMembershipFolderIds = new Map<string, string[]>();
  for (const membership of memberships) {
    const current = feedToMembershipFolderIds.get(membership.feedId) ?? [];
    current.push(membership.folderId);
    feedToMembershipFolderIds.set(membership.feedId, current);
  }

  const exclusiveFeedIds: string[] = [];
  const crossListedFeedIds: string[] = [];
  const nextLegacyFolderIdByFeedId = new Map<string, string | null>();

  for (const feed of userFeeds) {
    const assignedFolderIds = resolveFeedFolderIds({
      legacyFolderId: feed.folderId,
      membershipFolderIds: feedToMembershipFolderIds.get(feed.id) ?? [],
    });

    if (!assignedFolderIds.includes(folderId)) {
      continue;
    }

    if (assignedFolderIds.length <= 1) {
      exclusiveFeedIds.push(feed.id);
      nextLegacyFolderIdByFeedId.set(feed.id, null);
      continue;
    }

    crossListedFeedIds.push(feed.id);
    const nextFolderId = normalizeFolderIds(
      assignedFolderIds.filter((candidate) => candidate !== folderId)
    )[0];
    nextLegacyFolderIdByFeedId.set(feed.id, nextFolderId ?? null);
  }

  return {
    totalFeeds: exclusiveFeedIds.length + crossListedFeedIds.length,
    exclusiveFeedIds,
    crossListedFeedIds,
    nextLegacyFolderIdByFeedId,
  };
}

/**
 * Delete one folder for one user using the requested mode.
 */
export async function deleteFolderForUser(
  userId: string,
  folderId: string,
  mode: DeleteFolderMode
): Promise<DeleteFolderForUserResult> {
  const targetFolder = await db.query.folders.findFirst({
    where: and(eq(folders.id, folderId), eq(folders.userId, userId)),
    columns: { id: true },
  });

  if (!targetFolder) {
    return { status: "not_found" };
  }

  const summary = await buildFolderMembershipSummary(userId, folderId);
  const now = new Date();

  // neon-http does not support db.transaction(); execute writes sequentially.
  if (mode === "remove_and_unsubscribe_exclusive") {
    if (summary.exclusiveFeedIds.length > 0) {
      await db
        .delete(feeds)
        .where(
          and(
            eq(feeds.userId, userId),
            inArray(feeds.id, summary.exclusiveFeedIds)
          )
        );
    }

    for (const feedId of summary.crossListedFeedIds) {
      const nextLegacyFolderId = summary.nextLegacyFolderIdByFeedId.get(feedId) ?? null;
      await db
        .update(feeds)
        .set({
          folderId: nextLegacyFolderId,
          updatedAt: now,
        })
        .where(and(eq(feeds.id, feedId), eq(feeds.userId, userId)));
    }
  } else {
    await db
      .update(feeds)
      .set({
        folderId: null,
        updatedAt: now,
      })
      .where(and(eq(feeds.userId, userId), eq(feeds.folderId, folderId)));
  }

  await db
    .delete(folders)
    .where(and(eq(folders.id, folderId), eq(folders.userId, userId)));

  return {
    status: "ok",
    mode,
    totalFeeds: summary.totalFeeds,
    exclusiveFeeds: summary.exclusiveFeedIds.length,
    crossListedFeeds: summary.crossListedFeedIds.length,
    unsubscribedFeeds:
      mode === "remove_and_unsubscribe_exclusive"
        ? summary.exclusiveFeedIds.length
        : 0,
  };
}
