/**
 * API Route: /api/refresh
 *
 * POST /api/refresh — Fetch new articles from all of the user's feeds.
 *
 * There is no background polling. Refresh happens only on explicit user action.
 */

import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { ensureUserRecord } from "@/lib/app-user";
import { refreshFeedsForUser } from "@/lib/feed-service";

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

    const refresh = await refreshFeedsForUser(ensuredUser.id);

    if (refresh.status === "user_not_found") {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    if (refresh.results.length === 0) {
      return NextResponse.json({
        message: refresh.message || "No feeds to refresh",
        results: [],
        retentionDeletedCount: refresh.retentionDeletedCount,
      });
    }

    return NextResponse.json({
      results: refresh.results,
      retentionDeletedCount: refresh.retentionDeletedCount,
    });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
