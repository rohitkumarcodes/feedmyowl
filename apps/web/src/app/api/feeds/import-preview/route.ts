import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { ensureUserRecord } from "@/lib/app-user";
import { handleApiRouteError } from "@/lib/api-errors";
import { assertTrustedWriteOrigin } from "@/lib/csrf";
import { captureMessage } from "@/lib/error-tracking";
import { parseRequestJsonWithLimit } from "@/lib/http/request-json";
import { applyRouteRateLimit } from "@/lib/rate-limit";
import { getFoldersForUser } from "@/lib/folder-service";
import { normalizeFeedUrl } from "@/lib/feed-url";
import {
  normalizeAndMergeImportEntries,
  parseImportFileContents,
} from "@/lib/feed-import-file";
import type {
  FeedImportEntry,
  FeedImportPreview,
  FeedImportPreviewEntry,
  FeedImportSourceType,
} from "@/lib/feed-import-types";
import {
  FEED_IMPORT_MAX_TOTAL_ENTRIES,
  FEED_IMPORT_MAX_REQUEST_BYTES,
} from "@/lib/feed-import-types";

interface ParseFileResult {
  status: "ok";
  fileName: string;
  sourceType: FeedImportSourceType;
  entries: FeedImportEntry[];
}

function parseImportFile(value: unknown): ParseFileResult {
  if (!value || typeof value !== "object") {
    throw new Error("file must be an object.");
  }

  const file = value as Record<string, unknown>;
  const fileName = file.fileName;
  const fileContents = file.fileContents;

  if (typeof fileName !== "string" || !fileName.trim()) {
    throw new Error("file.fileName must be a non-empty string.");
  }

  if (typeof fileContents !== "string" || !fileContents.trim()) {
    throw new Error("file.fileContents must be a non-empty string.");
  }

  const parsed = parseImportFileContents(fileName, fileContents);
  const normalized = normalizeAndMergeImportEntries(parsed.entries);

  return {
    status: "ok",
    fileName: fileName.trim(),
    sourceType: parsed.sourceType,
    entries: normalized,
  };
}

function badRequest(error: string) {
  return NextResponse.json({ error }, { status: 400 });
}

/**
 * POST /api/feeds/import-preview
 * 
 * Generates a preview of an import file without actually importing.
 * Validates URLs and checks for existing subscriptions.
 */
export async function POST(request: NextRequest) {
  try {
    const csrfFailure = assertTrustedWriteOrigin(request, "api.feeds.import_preview.post");
    if (csrfFailure) {
      return csrfFailure;
    }

    const { clerkId } = await requireAuth();
    const appUser = await ensureUserRecord(clerkId);

    if (!appUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const rateLimit = await applyRouteRateLimit({
      request,
      routeKey: "api_feeds_import_preview_post",
      userId: appUser.id,
      userLimitPerMinute: 25,
      ipLimitPerMinute: 100,
    });

    if (!rateLimit.allowed) {
      return rateLimit.response;
    }

    const payloadResult = await parseRequestJsonWithLimit(request, {
      maxBytes: FEED_IMPORT_MAX_REQUEST_BYTES,
    });

    if (payloadResult.status === "payload_too_large") {
      return badRequest(
        `Request payload exceeds ${FEED_IMPORT_MAX_REQUEST_BYTES} bytes.`
      );
    }

    if (payloadResult.status !== "ok") {
      return badRequest("Invalid JSON body.");
    }

    const payload = payloadResult.payload;

    // Parse the import file
    let parseResult: ParseFileResult;
    try {
      parseResult = parseImportFile(payload.file);
    } catch (error) {
      return badRequest(
        error instanceof Error ? error.message : "Could not parse import file."
      );
    }

    const { fileName, sourceType, entries } = parseResult;

    if (entries.length === 0) {
      return badRequest("No valid feed URLs found in the import file.");
    }

    if (entries.length > FEED_IMPORT_MAX_TOTAL_ENTRIES) {
      return badRequest(
        `Import file contains ${entries.length} feeds. Maximum is ${FEED_IMPORT_MAX_TOTAL_ENTRIES}.`
      );
    }

    // Get user's existing feeds and folders
    const existingFeeds = await Promise.all(
      entries.map(async (entry) => {
        const normalizedUrl = normalizeFeedUrl(entry.url);
        if (!normalizedUrl) {
          return null;
        }
        return findExistingFeedForUserByUserId(appUser.id, normalizedUrl);
      })
    );

    const userFolders = await getFoldersForUser(appUser.id);
    const existingFolderSet = new Set(
      userFolders.map((f) => f.name.toLowerCase())
    );

    // Collect all folder names from the import
    const importFolderSet = new Set<string>();
    for (const entry of entries) {
      for (const folderName of entry.folderNames) {
        importFolderSet.add(folderName);
      }
    }

    // Build preview entries
    const previewEntries: FeedImportPreviewEntry[] = entries.map((entry, index) => {
      const existingFeed = existingFeeds[index];
      const normalizedUrl = normalizeFeedUrl(entry.url);

      if (!normalizedUrl) {
        return {
          url: entry.url,
          customTitle: entry.customTitle,
          folderNames: entry.folderNames,
          status: "error" as const,
          errorMessage: "Invalid URL format",
        };
      }

      if (existingFeed) {
        // Check if folder assignments differ
        const existingFolderNames = userFolders
          .filter((f) =>
            existingFeed.folderIds?.some((fid) => fid === f.id)
          )
          .map((f) => f.name);

        const importFoldersLower = new Set(
          entry.folderNames.map((f) => f.toLowerCase())
        );
        const existingFoldersLower = new Set(
          existingFolderNames.map((f) => f.toLowerCase())
        );

        // Check if folders are different
        const hasFolderDiff =
          importFoldersLower.size !== existingFoldersLower.size ||
          [...importFoldersLower].some((f) => !existingFoldersLower.has(f));

        return {
          url: entry.url,
          customTitle: entry.customTitle,
          folderNames: entry.folderNames,
          status: "duplicate" as const,
          existingFeedId: existingFeed.id,
          existingFolderNames,
          errorMessage: hasFolderDiff
            ? `Already subscribed with different folders`
            : undefined,
        };
      }

      // Check for invalid folder names (not in user's folders and not new)
      const invalidFolders: string[] = [];
      for (const folderName of entry.folderNames) {
        const normalizedFolder = folderName.trim().toLowerCase();
        if (!existingFolderSet.has(normalizedFolder) && !importFolderSet.has(folderName)) {
          invalidFolders.push(folderName);
        }
      }

      if (invalidFolders.length > 0) {
        return {
          url: entry.url,
          customTitle: entry.customTitle,
          folderNames: entry.folderNames,
          status: "error" as const,
          errorMessage: `Invalid folder(s): ${invalidFolders.join(", ")}`,
        };
      }

      return {
        url: entry.url,
        customTitle: entry.customTitle,
        folderNames: entry.folderNames,
        status: "new" as const,
      };
    });

    // Calculate summary counts
    const newCount = previewEntries.filter((e) => e.status === "new").length;
    const duplicateCount = previewEntries.filter((e) => e.status === "duplicate").length;
    const errorCount = previewEntries.filter((e) => e.status === "error").length;

    // Collect unique folder names
    const allFolderNames = [...importFolderSet];

    const preview: FeedImportPreview = {
      sourceType,
      fileName,
      totalCount: entries.length,
      newCount,
      duplicateCount,
      errorCount,
      folderNames: allFolderNames,
      entries: previewEntries,
    };

    captureMessage(
      `feeds.import_preview.completed route=api.feeds.import_preview.post source=${sourceType} total=${preview.totalCount} new=${preview.newCount} duplicates=${preview.duplicateCount} errors=${preview.errorCount}`
    );

    return NextResponse.json(preview);
  } catch (error) {
    return handleApiRouteError(error, "api.feeds.import_preview.post");
  }
}

/**
 * Look up an existing feed for one user by normalized URL.
 * This is a wrapper that also returns folder IDs.
 */
async function findExistingFeedForUserByUserId(userId: string, url: string) {
  const { db } = await import("@/lib/database");

  const feed = await db.query.feeds.findFirst({
    where: (feeds, { eq, and }) =>
      and(eq(feeds.userId, userId), eq(feeds.url, url)),
  });

  if (!feed) {
    return null;
  }

  // Get folder memberships
  const memberships = await db.query.feedFolderMemberships.findMany({
    where: (memberships, { eq, and }) =>
      and(eq(memberships.userId, userId), eq(memberships.feedId, feed.id)),
  });

  return {
    ...feed,
    folderIds: memberships.map((m) => m.folderId),
  };
}
