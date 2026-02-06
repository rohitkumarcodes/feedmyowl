/**
 * API Route: /api/refresh
 *
 * POST /api/refresh — Fetch new articles from all of the user's feeds
 *
 * This is triggered by the user pressing the "Refresh" button.
 * There is NO background polling — feeds are only fetched when
 * the user explicitly requests it. (Principle 7: reading experience is sacred)
 *
 * How it works:
 *   1. Get all feeds for the authenticated user
 *   2. Fetch and parse each feed URL in parallel
 *   3. Insert new items (skip duplicates by checking guid)
 *   4. Update last_fetched_at on each feed
 *   5. Return the results
 */

import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/database";
import { feeds, feedItems, users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { parseFeed } from "@/lib/feed-parser";
import { captureError } from "@/lib/error-tracking";

/**
 * POST /api/refresh
 * Fetches all feeds for the authenticated user and stores new items.
 */
export async function POST() {
  try {
    const { clerkId } = await requireAuth();

    // Find the user and their feeds
    const user = await db.query.users.findFirst({
      where: eq(users.clerkId, clerkId),
      with: { feeds: true },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    if (user.feeds.length === 0) {
      return NextResponse.json({ message: "No feeds to refresh", results: [] });
    }

    // Fetch all feeds in parallel to stay within serverless time limits
    const results = await Promise.allSettled(
      user.feeds.map(async (feed) => {
        try {
          const parsed = await parseFeed(feed.url);

          // Update feed title/description if we got them
          await db
            .update(feeds)
            .set({
              title: parsed.title || feed.title,
              description: parsed.description || feed.description,
              lastFetchedAt: new Date(),
              updatedAt: new Date(),
            })
            .where(eq(feeds.id, feed.id));

          // Get existing guids for this feed to avoid duplicates
          const existingItems = await db.query.feedItems.findMany({
            where: eq(feedItems.feedId, feed.id),
            columns: { guid: true },
          });
          const existingGuids = new Set(existingItems.map((item) => item.guid));

          // Insert only new items
          const newItems = parsed.items.filter(
            (item) => item.guid && !existingGuids.has(item.guid)
          );

          if (newItems.length > 0) {
            await db.insert(feedItems).values(
              newItems.map((item) => ({
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
            newItemCount: newItems.length,
            status: "success" as const,
          };
        } catch (error) {
          captureError(error, { feedId: feed.id, feedUrl: feed.url });
          return {
            feedId: feed.id,
            feedUrl: feed.url,
            newItemCount: 0,
            status: "error" as const,
            error: error instanceof Error ? error.message : "Unknown error",
          };
        }
      })
    );

    // Extract the values from the settled promises
    const refreshResults = results.map((result) =>
      result.status === "fulfilled"
        ? result.value
        : { status: "error" as const, error: "Feed fetch failed" }
    );

    return NextResponse.json({ results: refreshResults });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
