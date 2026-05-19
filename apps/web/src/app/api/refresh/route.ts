/**
 * API Route: /api/refresh
 *
 * POST /api/refresh — Fetch new articles from all of the user's feeds.
 *
 * There is no background polling. Refresh happens only on explicit user action.
 */

import { NextResponse } from "next/server";
import { handleApiRouteError } from "@/lib/server/api-errors";
import { refreshAllFeeds } from "@/lib/server/feed-service";
import type { RefreshResponseBody } from "@/contracts/api/refresh";

export async function POST() {
  try {
    const refresh = await refreshAllFeeds();

    if (refresh.results.length === 0) {
      return NextResponse.json({
        message: refresh.message || "No feeds to refresh",
        results: [],
        retentionDeletedCount: refresh.retentionDeletedCount,
      } satisfies RefreshResponseBody);
    }

    return NextResponse.json({
      results: refresh.results,
      retentionDeletedCount: refresh.retentionDeletedCount,
    } satisfies RefreshResponseBody);
  } catch (error) {
    return handleApiRouteError(error, "api.refresh.post");
  }
}
