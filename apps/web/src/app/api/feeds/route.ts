/**
 * API Route: /api/feeds
 *
 * Handles feed, folder, import, extraction, and account actions for the
 * authenticated user while keeping route surface area small.
 */

import { NextRequest, NextResponse } from "next/server";
import {
  and,
  db,
  eq,
  feedItems,
  feeds,
  folders,
  users,
} from "@/lib/database";
import { deleteAuthUser, requireAuth } from "@/lib/auth";
import { ensureUserRecord } from "@/lib/app-user";
import { parseFeed, type ParsedFeed } from "@/lib/feed-parser";
import { extractArticleFromUrl } from "@/lib/article-extractor";
import { purgeOldFeedItemsForUser } from "@/lib/retention";

interface ApiError {
  error: string;
  code?: string;
}

interface OpmlImportEntry {
  url?: unknown;
  title?: unknown;
  folderName?: unknown;
}

/**
 * Safely parse JSON request bodies and return null for invalid JSON.
 */
async function parseRequestJson(
  request: NextRequest
): Promise<Record<string, unknown> | null> {
  try {
    return (await request.json()) as Record<string, unknown>;
  } catch {
    return null;
  }
}

/**
 * Resolve the currently authenticated application user row.
 */
async function getAppUser() {
  const { clerkId } = await requireAuth();
  return await ensureUserRecord(clerkId);
}

/**
 * Normalize and validate URL input before feed processing.
 */
function normalizeFeedUrl(rawUrl: unknown): string | null {
  if (typeof rawUrl !== "string") {
    return null;
  }

  const trimmed = rawUrl.trim();
  if (!trimmed) {
    return null;
  }

  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return null;
    }

    return parsed.toString();
  } catch {
    return null;
  }
}

/**
 * Derive calm feed-validation messages for user-facing inline errors.
 */
function toFeedValidationError(error: unknown): {
  code: string;
  message: string;
} {
  const rawMessage =
    error instanceof Error ? error.message.toLowerCase() : "unknown error";

  if (rawMessage.includes("404")) {
    return {
      code: "http_404",
      message:
        "This feed could not be reached. The server returned a 404, which usually means the feed URL changed.",
    };
  }

  if (rawMessage.includes("timed out") || rawMessage.includes("timeout")) {
    return {
      code: "timeout",
      message:
        "This feed could not be updated. The server did not respond in time. This is often temporary.",
    };
  }

  if (
    rawMessage.includes("xml") ||
    rawMessage.includes("rss") ||
    rawMessage.includes("atom") ||
    rawMessage.includes("not valid")
  ) {
    return {
      code: "invalid_xml",
      message:
        "This URL does not appear to be a valid RSS or Atom feed.",
    };
  }

  if (rawMessage.includes("fetch") || rawMessage.includes("network")) {
    return {
      code: "network",
      message: "Could not reach this URL. Check the address and try again.",
    };
  }

  return {
    code: "unreachable",
    message: "Could not reach this URL. Check the address and try again.",
  };
}

/**
 * Create a new feed row and insert parsed feed items from the first successful fetch.
 */
async function createFeedWithInitialItems(
  userId: string,
  url: string,
  parsedFeed: ParsedFeed,
  folderId: string | null
) {
  const now = new Date();

  const [newFeed] = await db
    .insert(feeds)
    .values({
      userId,
      url,
      folderId,
      title: parsedFeed.title || null,
      description: parsedFeed.description || null,
      lastFetchedAt: now,
      lastFetchStatus: "success",
      lastFetchErrorCode: null,
      lastFetchErrorMessage: null,
      lastFetchErrorAt: null,
      updatedAt: now,
    })
    .returning();

  const insertableItems = parsedFeed.items.filter((item) => item.guid);

  if (insertableItems.length > 0) {
    await db.insert(feedItems).values(
      insertableItems.map((item) => ({
        feedId: newFeed.id,
        guid: item.guid,
        title: item.title,
        link: item.link,
        content: item.content,
        author: item.author,
        publishedAt: item.publishedAt,
      }))
    );
  }

  return { feed: newFeed, insertedItems: insertableItems.length };
}

/**
 * Normalize folder names for OPML import grouping.
 */
function normalizeFolderName(rawName: unknown): string | null {
  if (typeof rawName !== "string") {
    return null;
  }

  const trimmed = rawName.trim();
  if (!trimmed) {
    return null;
  }

  if (trimmed.toLowerCase() === "uncategorized") {
    return null;
  }

  return trimmed;
}

/**
 * GET /api/feeds
 * Returns folders and feeds for the authenticated user.
 */
export async function GET() {
  try {
    const appUser = await getAppUser();

    if (!appUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Keep retention policy enforced even during read-heavy sessions.
    await purgeOldFeedItemsForUser(appUser.id);

    const user = await db.query.users.findFirst({
      where: eq(users.id, appUser.id),
      with: {
        folders: true,
        feeds: {
          with: {
            items: true,
          },
        },
      },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json({ folders: user.folders, feeds: user.feeds });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

/**
 * POST /api/feeds
 *
 * Supported actions:
 *   - feed.create (and legacy { url } payload)
 *   - folder.create
 *   - opml.import
 */
export async function POST(request: NextRequest) {
  try {
    const appUser = await getAppUser();

    if (!appUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const payload = await parseRequestJson(request);
    if (!payload) {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const rawAction = payload.action;

    // Backward compatibility: when action is omitted but `url` exists,
    // treat it as feed.create.
    const action =
      typeof rawAction === "string"
        ? rawAction
        : typeof payload.url === "string"
          ? "feed.create"
          : null;

    if (action === "folder.create") {
      const name = payload.name;
      const nextName = typeof name === "string" ? name.trim() : "";

      if (!nextName) {
        return NextResponse.json(
          { error: "Folder name is required" },
          { status: 400 }
        );
      }

      const [newFolder] = await db
        .insert(folders)
        .values({
          userId: appUser.id,
          name: nextName,
        })
        .returning();

      return NextResponse.json({ folder: newFolder }, { status: 201 });
    }

    if (action === "feed.create") {
      const nextUrl = normalizeFeedUrl(payload.url);

      if (!nextUrl) {
        return NextResponse.json(
          {
            error: "This URL does not appear to be valid.",
            code: "invalid_url",
          } satisfies ApiError,
          { status: 400 }
        );
      }

      const folderId = payload.folderId;
      let validatedFolderId: string | null = null;
      if (folderId !== undefined && folderId !== null) {
        if (typeof folderId !== "string" || !folderId.trim()) {
          return NextResponse.json(
            { error: "Invalid folder ID" },
            { status: 400 }
          );
        }

        const folder = await db.query.folders.findFirst({
          where: and(eq(folders.id, folderId), eq(folders.userId, appUser.id)),
        });

        if (!folder) {
          return NextResponse.json({ error: "Folder not found" }, { status: 404 });
        }

        validatedFolderId = folder.id;
      }

      const existingFeed = await db.query.feeds.findFirst({
        where: and(eq(feeds.userId, appUser.id), eq(feeds.url, nextUrl)),
      });

      if (existingFeed) {
        return NextResponse.json({
          feed: existingFeed,
          duplicate: true,
          message: "This feed is already in your library.",
        });
      }

      let parsedFeed: ParsedFeed;
      try {
        parsedFeed = await parseFeed(nextUrl);
      } catch (error) {
        const normalizedError = toFeedValidationError(error);
        return NextResponse.json(
          {
            error: normalizedError.message,
            code: normalizedError.code,
          } satisfies ApiError,
          { status: 400 }
        );
      }

      let created: Awaited<ReturnType<typeof createFeedWithInitialItems>> | null =
        null;
      try {
        created = await createFeedWithInitialItems(
          appUser.id,
          nextUrl,
          parsedFeed,
          validatedFolderId
        );
      } catch {
        const raceExistingFeed = await db.query.feeds.findFirst({
          where: and(eq(feeds.userId, appUser.id), eq(feeds.url, nextUrl)),
        });

        if (raceExistingFeed) {
          return NextResponse.json({
            feed: raceExistingFeed,
            duplicate: true,
            message: "This feed is already in your library.",
          });
        }

        return NextResponse.json(
          { error: "Could not add this feed right now." },
          { status: 500 }
        );
      }

      if (!created) {
        return NextResponse.json(
          { error: "Could not add this feed right now." },
          { status: 500 }
        );
      }

      return NextResponse.json(
        {
          feed: created.feed,
          importedItemCount: created.insertedItems,
          duplicate: false,
        },
        { status: 201 }
      );
    }

    if (action === "opml.import") {
      const entries = Array.isArray(payload.entries)
        ? (payload.entries as OpmlImportEntry[])
        : null;

      if (!entries || entries.length === 0) {
        return NextResponse.json(
          { error: "Import entries are required" },
          { status: 400 }
        );
      }

      const existingFeeds = await db.query.feeds.findMany({
        where: eq(feeds.userId, appUser.id),
        columns: { id: true, url: true },
      });

      const existingUrlSet = new Set(existingFeeds.map((feed) => feed.url));

      const existingFolders = await db.query.folders.findMany({
        where: eq(folders.userId, appUser.id),
      });

      const folderMap = new Map<string, string>();
      for (const folder of existingFolders) {
        folderMap.set(folder.name.toLowerCase(), folder.id);
      }

      let importedCount = 0;
      let skippedCount = 0;
      let processedCount = 0;

      for (const entry of entries) {
        processedCount += 1;

        const normalizedUrl = normalizeFeedUrl(entry.url);
        if (!normalizedUrl) {
          skippedCount += 1;
          continue;
        }

        if (existingUrlSet.has(normalizedUrl)) {
          skippedCount += 1;
          continue;
        }

        const normalizedFolderName = normalizeFolderName(entry.folderName);
        let resolvedFolderId: string | null = null;

        if (normalizedFolderName) {
          const folderLookupKey = normalizedFolderName.toLowerCase();
          const existingFolderId = folderMap.get(folderLookupKey);

          if (existingFolderId) {
            resolvedFolderId = existingFolderId;
          } else {
            const [createdFolder] = await db
              .insert(folders)
              .values({
                userId: appUser.id,
                name: normalizedFolderName,
              })
              .returning();

            folderMap.set(folderLookupKey, createdFolder.id);
            resolvedFolderId = createdFolder.id;
          }
        }

        let parsedFeed: ParsedFeed;
        try {
          parsedFeed = await parseFeed(normalizedUrl);
        } catch {
          skippedCount += 1;
          continue;
        }

        try {
          await createFeedWithInitialItems(
            appUser.id,
            normalizedUrl,
            parsedFeed,
            resolvedFolderId
          );
          existingUrlSet.add(normalizedUrl);
          importedCount += 1;
        } catch {
          // If a race inserts the same URL first, treat it as skipped duplicate.
          skippedCount += 1;
        }
      }

      return NextResponse.json({
        totalCount: entries.length,
        processedCount,
        importedCount,
        skippedCount,
      });
    }

    return NextResponse.json({ error: "Unsupported action" }, { status: 400 });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

/**
 * PATCH /api/feeds
 *
 * Supported actions:
 *   - folder.rename
 *   - folder.delete
 *   - item.markRead
 *   - item.extractFull
 *   - account.delete
 */
export async function PATCH(request: NextRequest) {
  try {
    const appUser = await getAppUser();

    if (!appUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const payload = await parseRequestJson(request);
    if (!payload || typeof payload.action !== "string") {
      return NextResponse.json(
        { error: "Action is required" },
        { status: 400 }
      );
    }

    if (payload.action === "folder.rename") {
      const folderId = payload.folderId;
      const name = payload.name;
      const nextName = typeof name === "string" ? name.trim() : "";

      if (typeof folderId !== "string" || !folderId.trim()) {
        return NextResponse.json({ error: "Folder ID is required" }, { status: 400 });
      }

      if (!nextName) {
        return NextResponse.json(
          { error: "Folder name is required" },
          { status: 400 }
        );
      }

      const [renamedFolder] = await db
        .update(folders)
        .set({
          name: nextName,
          updatedAt: new Date(),
        })
        .where(and(eq(folders.id, folderId), eq(folders.userId, appUser.id)))
        .returning();

      if (!renamedFolder) {
        return NextResponse.json({ error: "Folder not found" }, { status: 404 });
      }

      return NextResponse.json({ folder: renamedFolder });
    }

    if (payload.action === "folder.delete") {
      const folderId = payload.folderId;

      if (typeof folderId !== "string" || !folderId.trim()) {
        return NextResponse.json({ error: "Folder ID is required" }, { status: 400 });
      }

      const folder = await db.query.folders.findFirst({
        where: and(eq(folders.id, folderId), eq(folders.userId, appUser.id)),
      });

      if (!folder) {
        return NextResponse.json({ error: "Folder not found" }, { status: 404 });
      }

      await db
        .update(feeds)
        .set({ folderId: null, updatedAt: new Date() })
        .where(and(eq(feeds.folderId, folder.id), eq(feeds.userId, appUser.id)));

      await db.delete(folders).where(eq(folders.id, folder.id));

      return NextResponse.json({
        success: true,
        folderId: folder.id,
        reassignedTo: "uncategorized",
      });
    }

    if (payload.action === "item.markRead") {
      const itemId = payload.itemId;

      if (typeof itemId !== "string" || !itemId.trim()) {
        return NextResponse.json({ error: "Item ID is required" }, { status: 400 });
      }

      const item = await db.query.feedItems.findFirst({
        where: eq(feedItems.id, itemId),
        with: {
          feed: {
            columns: {
              id: true,
              userId: true,
            },
          },
        },
      });

      if (!item || item.feed.userId !== appUser.id) {
        return NextResponse.json({ error: "Article not found" }, { status: 404 });
      }

      if (item.readAt) {
        return NextResponse.json({
          itemId: item.id,
          readAt: item.readAt.toISOString(),
          alreadyRead: true,
        });
      }

      const now = new Date();
      await db
        .update(feedItems)
        .set({ readAt: now, updatedAt: now })
        .where(eq(feedItems.id, item.id));

      return NextResponse.json({ itemId: item.id, readAt: now.toISOString() });
    }

    if (payload.action === "item.extractFull") {
      const itemId = payload.itemId;

      if (typeof itemId !== "string" || !itemId.trim()) {
        return NextResponse.json({ error: "Item ID is required" }, { status: 400 });
      }

      const item = await db.query.feedItems.findFirst({
        where: eq(feedItems.id, itemId),
        with: {
          feed: {
            columns: {
              id: true,
              userId: true,
            },
          },
        },
      });

      if (!item || item.feed.userId !== appUser.id) {
        return NextResponse.json({ error: "Article not found" }, { status: 404 });
      }

      if (item.extractedHtml && item.extractionStatus === "success") {
        return NextResponse.json({
          itemId: item.id,
          status: "success",
          source: item.extractionSource || "postlight",
          extractedHtml: item.extractedHtml,
          cached: true,
        });
      }

      const now = new Date();

      if (!item.link) {
        await db
          .update(feedItems)
          .set({
            extractionStatus: "fallback",
            extractionSource: "feed_summary",
            extractedAt: now,
            updatedAt: now,
          })
          .where(eq(feedItems.id, item.id));

        return NextResponse.json({
          itemId: item.id,
          status: "fallback",
          source: "feed_summary",
          extractedHtml: null,
          cached: false,
        });
      }

      const extracted = await extractArticleFromUrl(item.link);

      if (extracted.status === "success" && extracted.html) {
        await db
          .update(feedItems)
          .set({
            extractedHtml: extracted.html,
            extractedAt: now,
            extractionStatus: "success",
            extractionSource: extracted.source,
            updatedAt: now,
          })
          .where(eq(feedItems.id, item.id));

        return NextResponse.json({
          itemId: item.id,
          status: "success",
          source: extracted.source,
          extractedHtml: extracted.html,
          cached: false,
        });
      }

      await db
        .update(feedItems)
        .set({
          extractedAt: now,
          extractionStatus: "fallback",
          extractionSource: "feed_summary",
          updatedAt: now,
        })
        .where(eq(feedItems.id, item.id));

      return NextResponse.json({
        itemId: item.id,
        status: "fallback",
        source: "feed_summary",
        extractedHtml: null,
        cached: false,
      });
    }

    if (payload.action === "account.delete") {
      const confirmed = payload.confirm === true;
      if (!confirmed) {
        return NextResponse.json(
          { error: "Account deletion must be explicitly confirmed." },
          { status: 400 }
        );
      }

      try {
        await deleteAuthUser(appUser.clerkId);
      } catch {
        return NextResponse.json(
          { error: "Could not delete authentication account." },
          { status: 500 }
        );
      }

      await db.delete(users).where(eq(users.id, appUser.id));

      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "Unsupported action" }, { status: 400 });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
