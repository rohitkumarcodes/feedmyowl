/**
 * API Route: /api/refresh
 *
 * POST /api/refresh — Fetch new articles from all of the user's feeds.
 *
 * There is no background polling. Refresh happens only on explicit user action.
 */

import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { db, eq, feeds, feedItems, users } from "@/lib/database";
import { parseFeed } from "@/lib/feed-parser";
import { captureError } from "@/lib/error-tracking";
import { ensureUserRecord } from "@/lib/app-user";
import { purgeOldFeedItemsForUser } from "@/lib/retention";

interface RefreshResult {
  feedId: string;
  feedUrl: string;
  newItemCount: number;
  status: "success" | "error";
  errorCode?: string;
  errorMessage?: string;
}

/**
 * Translate fetch/parser failures into stable error codes and calm messages.
 */
function toRefreshError(error: unknown): {
  code: string;
  message: string;
} {
  const rawMessage =
    error instanceof Error ? error.message.toLowerCase() : "unknown error";

  if (rawMessage.includes("404")) {
    return {
      code: "http_404",
      message:
        "This feed could not be reached. The server returned a 404, which usually means the feed URL changed or no longer exists.",
    };
  }

  if (rawMessage.includes("timed out") || rawMessage.includes("timeout")) {
    return {
      code: "timeout",
      message:
        "This feed could not be updated. The server did not respond in time. This is usually temporary.",
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
        "This feed returned content that is not valid RSS or Atom XML.",
    };
  }

  if (rawMessage.includes("fetch") || rawMessage.includes("network")) {
    return {
      code: "network",
      message:
        "This feed could not be updated because the network request failed.",
    };
  }

  return {
    code: "unreachable",
    message: "This feed could not be updated right now.",
  };
}

/**
 * POST /api/refresh
 * Fetches all feeds for the authenticated user and stores new items.
 */
export async function POST() {
  try {
    const { clerkId } = await requireAuth();
    const ensuredUser = await ensureUserRecord(clerkId);

    if (!ensuredUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Enforce retention before writing new refresh data.
    const retentionDeletedCount = await purgeOldFeedItemsForUser(ensuredUser.id);

    // Find the user and their feeds
    const user = await db.query.users.findFirst({
      where: eq(users.id, ensuredUser.id),
      with: { feeds: true },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    if (user.feeds.length === 0) {
      return NextResponse.json({
        message: "No feeds to refresh",
        results: [],
        retentionDeletedCount,
      });
    }

    // Fetch all feeds in parallel to stay within serverless time limits.
    const results = await Promise.allSettled(
      user.feeds.map(async (feed): Promise<RefreshResult> => {
        try {
          const parsed = await parseFeed(feed.url);
          const now = new Date();

          // Update feed metadata + success status.
          await db
            .update(feeds)
            .set({
              title: parsed.title || feed.title,
              description: parsed.description || feed.description,
              lastFetchedAt: now,
              lastFetchStatus: "success",
              lastFetchErrorCode: null,
              lastFetchErrorMessage: null,
              lastFetchErrorAt: null,
              updatedAt: now,
            })
            .where(eq(feeds.id, feed.id));

          // Get existing guids for this feed to avoid duplicates.
          const existingItems = await db.query.feedItems.findMany({
            where: eq(feedItems.feedId, feed.id),
            columns: { guid: true },
          });
          const existingGuids = new Set(existingItems.map((item) => item.guid));

          const insertableItems = parsed.items.filter(
            (item) => item.guid && !existingGuids.has(item.guid)
          );

          if (insertableItems.length > 0) {
            await db.insert(feedItems).values(
              insertableItems.map((item) => ({
                feedId: feed.id,
                guid: item.guid,
                title: item.title,
                link: item.link,
                content: item.content,
                author: item.author,
                publishedAt: item.publishedAt,
              }))
            );
          }

          return {
            feedId: feed.id,
            feedUrl: feed.url,
            newItemCount: insertableItems.length,
            status: "success",
          };
        } catch (error) {
          const normalizedError = toRefreshError(error);
          const now = new Date();

          await db
            .update(feeds)
            .set({
              lastFetchStatus: "error",
              lastFetchErrorCode: normalizedError.code,
              lastFetchErrorMessage: normalizedError.message,
              lastFetchErrorAt: now,
              updatedAt: now,
            })
            .where(eq(feeds.id, feed.id));

          captureError(error, {
            feedId: feed.id,
            feedUrl: feed.url,
            code: normalizedError.code,
          });

          return {
            feedId: feed.id,
            feedUrl: feed.url,
            newItemCount: 0,
            status: "error",
            errorCode: normalizedError.code,
            errorMessage: normalizedError.message,
          };
        }
      })
    );

    // Extract successful values from settled promises.
    const refreshResults = results.map((result) =>
      result.status === "fulfilled"
        ? result.value
        : {
            feedId: "unknown",
            feedUrl: "unknown",
            newItemCount: 0,
            status: "error",
            errorCode: "refresh_failed",
            errorMessage: "Feed refresh failed.",
          }
    );

    return NextResponse.json({
      results: refreshResults,
      retentionDeletedCount,
    });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
