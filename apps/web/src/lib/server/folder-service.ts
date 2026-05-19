import "server-only";

import { db, eq, feeds, folders, inArray } from "@/lib/server/database";
import { isReservedFolderName } from "@/lib/shared/folders";
import { resolveFeedFolderIds } from "@/lib/shared/folder-memberships";

export const FOLDER_NAME_MAX_LENGTH = 255;

export const FOLDER_LIMIT = 50;

export interface FolderRecord {
  id: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * List all folders.
 */
export async function getAllFolders(): Promise<FolderRecord[]> {
  return await db.query.folders.findMany({
    columns: {
      id: true,
      name: true,
      createdAt: true,
      updatedAt: true,
    },
  });
}

export type CreateFolderResult =
  | { status: "invalid_name" }
  | { status: "reserved_name" }
  | { status: "duplicate_name" }
  | { status: "folder_limit_reached" }
  | { status: "ok"; folder: FolderRecord };

/**
 * Create one folder.
 */
export async function createFolder(name: string): Promise<CreateFolderResult> {
  const trimmedName = name.trim();
  if (!trimmedName || trimmedName.length > FOLDER_NAME_MAX_LENGTH) {
    return { status: "invalid_name" };
  }

  const normalizedName = trimmedName.toLocaleLowerCase();

  if (isReservedFolderName(normalizedName)) {
    return { status: "reserved_name" };
  }

  const existingFolders = await db.query.folders.findMany({
    columns: { id: true, name: true },
  });

  if (existingFolders.length >= FOLDER_LIMIT) {
    return { status: "folder_limit_reached" };
  }

  const hasDuplicate = existingFolders.some(
    (folder) => folder.name.trim().toLocaleLowerCase() === normalizedName,
  );

  if (hasDuplicate) {
    return { status: "duplicate_name" };
  }

  const now = new Date();

  try {
    const [created] = await db
      .insert(folders)
      .values({
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
  } catch (error: unknown) {
    // Unique index violation (TOCTOU safety net).
    if (isUniqueViolation(error)) {
      return { status: "duplicate_name" };
    }
    throw error;
  }
}

/**
 * Detect a PostgreSQL unique_violation (code 23505) from neon-http errors.
 */
function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code: string }).code === "23505"
  );
}

export type RenameFolderResult =
  | { status: "invalid_name" }
  | { status: "reserved_name" }
  | { status: "duplicate_name" }
  | { status: "not_found" }
  | { status: "ok"; folder: FolderRecord };

/**
 * Rename one folder.
 */
export async function renameFolder(
  folderId: string,
  name: string,
): Promise<RenameFolderResult> {
  const trimmedName = name.trim();
  if (!trimmedName || trimmedName.length > FOLDER_NAME_MAX_LENGTH) {
    return { status: "invalid_name" };
  }

  if (isReservedFolderName(trimmedName)) {
    return { status: "reserved_name" };
  }

  const existingFolder = await db.query.folders.findFirst({
    where: eq(folders.id, folderId),
    columns: { id: true, name: true },
  });

  if (!existingFolder) {
    return { status: "not_found" };
  }

  const allFolders = await db.query.folders.findMany({
    columns: { id: true, name: true },
  });

  const normalizedName = trimmedName.toLocaleLowerCase();
  const hasDuplicate = allFolders.some(
    (folder) =>
      folder.id !== folderId && folder.name.trim().toLocaleLowerCase() === normalizedName,
  );

  if (hasDuplicate) {
    return { status: "duplicate_name" };
  }

  const now = new Date();

  try {
    const [updatedFolder] = await db
      .update(folders)
      .set({
        name: trimmedName,
        updatedAt: now,
      })
      .where(eq(folders.id, folderId))
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
  } catch (error: unknown) {
    // Unique index violation (TOCTOU safety net).
    if (isUniqueViolation(error)) {
      return { status: "duplicate_name" };
    }
    throw error;
  }
}

export type DeleteFolderMode = "remove_only" | "remove_and_unsubscribe_exclusive";

export type DeleteFolderResult =
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
}

async function buildFolderMembershipSummary(
  folderId: string,
): Promise<FolderMembershipSummary> {
  const allFeeds = await db.query.feeds.findMany({
    columns: { id: true },
  });

  const memberships = await db.query.feedFolderMemberships.findMany({
    columns: { feedId: true, folderId: true },
  });

  const feedToMembershipFolderIds = new Map<string, string[]>();
  for (const membership of memberships) {
    const current = feedToMembershipFolderIds.get(membership.feedId) ?? [];
    current.push(membership.folderId);
    feedToMembershipFolderIds.set(membership.feedId, current);
  }

  const exclusiveFeedIds: string[] = [];
  const crossListedFeedIds: string[] = [];

  for (const feed of allFeeds) {
    const assignedFolderIds = resolveFeedFolderIds(
      feedToMembershipFolderIds.get(feed.id) ?? [],
    );

    if (!assignedFolderIds.includes(folderId)) {
      continue;
    }

    if (assignedFolderIds.length <= 1) {
      exclusiveFeedIds.push(feed.id);
      continue;
    }

    crossListedFeedIds.push(feed.id);
  }

  return {
    totalFeeds: exclusiveFeedIds.length + crossListedFeedIds.length,
    exclusiveFeedIds,
    crossListedFeedIds,
  };
}

/**
 * Delete one folder using the requested mode.
 */
export async function deleteFolder(
  folderId: string,
  mode: DeleteFolderMode,
): Promise<DeleteFolderResult> {
  const targetFolder = await db.query.folders.findFirst({
    where: eq(folders.id, folderId),
    columns: { id: true },
  });

  if (!targetFolder) {
    return { status: "not_found" };
  }

  const summary = await buildFolderMembershipSummary(folderId);

  // neon-http does not support db.transaction(); execute writes sequentially.
  if (mode === "remove_and_unsubscribe_exclusive") {
    if (summary.exclusiveFeedIds.length > 0) {
      await db.delete(feeds).where(inArray(feeds.id, summary.exclusiveFeedIds));
    }

    // Cross-listed feeds stay subscribed via remaining memberships.
  }

  await db.delete(folders).where(eq(folders.id, folderId));

  return {
    status: "ok",
    mode,
    totalFeeds: summary.totalFeeds,
    exclusiveFeeds: summary.exclusiveFeedIds.length,
    crossListedFeeds: summary.crossListedFeedIds.length,
    unsubscribedFeeds:
      mode === "remove_and_unsubscribe_exclusive" ? summary.exclusiveFeedIds.length : 0,
  };
}
