/**
 * API Route: /api/feeds
 *
 * Handles feed subscription management:
 *   GET  /api/feeds — List all feeds for the authenticated user
 *   POST /api/feeds — Subscribe to a new feed
 *
 * Authentication is required (enforced by middleware).
 * Free users are limited to 10 feeds (enforced here).
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { db, eq, feeds, users } from "@/lib/database";
import { ensureUserRecord } from "@/lib/app-user";

/**
 * GET /api/feeds
 * Returns all feeds for the authenticated user.
 */
export async function GET() {
  try {
    const { clerkId } = await requireAuth();

    const ensuredUser = await ensureUserRecord(clerkId);
    if (!ensuredUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Find the user in our database by their Clerk ID
    const user = await db.query.users.findFirst({
      where: eq(users.id, ensuredUser.id),
      with: { feeds: true },
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
 * Subscribe to a new feed. Expects JSON body: { url: string }
 * Enforces the free tier limit of 10 feeds.
 */
export async function POST(request: NextRequest) {
  try {
    const { clerkId } = await requireAuth();
    const { url } = await request.json();

    if (!url || typeof url !== "string") {
      return NextResponse.json(
        { error: "Feed URL is required" },
        { status: 400 }
      );
    }

    const ensuredUser = await ensureUserRecord(clerkId);
    if (!ensuredUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Find the user in our database
    const user = await db.query.users.findFirst({
      where: eq(users.id, ensuredUser.id),
      with: { feeds: true },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Enforce free tier limit: max 10 feeds
    const FREE_FEED_LIMIT = 10;
    if (
      user.subscriptionTier === "free" &&
      user.feeds.length >= FREE_FEED_LIMIT
    ) {
      return NextResponse.json(
        {
          error: `Free tier is limited to ${FREE_FEED_LIMIT} feeds. Upgrade to add more.`,
        },
        { status: 403 }
      );
    }

    // Create the feed subscription
    const [newFeed] = await db
      .insert(feeds)
      .values({ userId: user.id, url })
      .returning();

    return NextResponse.json({ feed: newFeed }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
