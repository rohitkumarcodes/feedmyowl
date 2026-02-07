/**
 * API Route: /api/feeds
 *
 * Handles feed creation, article read/extraction actions, and account deletion
 * for the authenticated user while keeping the surface area minimal.
 */

import { NextRequest, NextResponse } from "next/server";
import { and, db, eq, feedItems, feeds, users } from "@/lib/database";
import { deleteAuthUser, requireAuth } from "@/lib/auth";
import { ensureUserRecord } from "@/lib/app-user";
import { parseFeed, type ParsedFeed } from "@/lib/feed-parser";
import { extractArticleFromUrl } from "@/lib/article-extractor";
import { purgeOldFeedItemsForUser } from "@/lib/retention";

interface ApiError {
  error: string;
  code?: string;
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
      message: "This URL does not appear to be a valid RSS or Atom feed.",
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
  parsedFeed: ParsedFeed
) {
  const now = new Date();

  const [newFeed] = await db
    .insert(feeds)
    .values({
      userId,
      url,
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
 * GET /api/feeds
 * Returns feeds for the authenticated user.
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

    return NextResponse.json({ feeds: user.feeds });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

/**
 * POST /api/feeds
 *
 * Supported actions:
 *   - feed.create (and legacy { url } payload)
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

    if (action !== "feed.create") {
      return NextResponse.json({ error: "Unsupported action" }, { status: 400 });
    }

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

    let created: Awaited<ReturnType<typeof createFeedWithInitialItems>> | null = null;
    try {
      created = await createFeedWithInitialItems(appUser.id, nextUrl, parsedFeed);
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
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

/**
 * PATCH /api/feeds
 *
 * Supported actions:
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
      return NextResponse.json({ error: "Action is required" }, { status: 400 });
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
