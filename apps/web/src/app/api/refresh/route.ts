/**
 * API Route: /api/refresh
 *
 * POST /api/refresh — Fetch new articles from all of the user's feeds.
 *
 * There is no background polling. Refresh happens only on explicit user action.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { handleApiRouteError } from "@/lib/api-errors";
import { ensureUserRecord } from "@/lib/app-user";
import { assertTrustedWriteOrigin } from "@/lib/csrf";
import { refreshFeedsForUser } from "@/lib/feed-service";
import { applyRouteRateLimit } from "@/lib/rate-limit";

/**
 * POST /api/refresh
 * Fetches all feeds for the authenticated user and stores new items.
 */
export async function POST(request: NextRequest) {
  try {
    const csrfFailure = assertTrustedWriteOrigin(request, "api.refresh.post");
    if (csrfFailure) {
      return csrfFailure;
    }

    const { clerkId } = await requireAuth();
    const ensuredUser = await ensureUserRecord(clerkId);

    if (!ensuredUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const rateLimit = await applyRouteRateLimit({
      request,
      routeKey: "api_refresh_post",
      userId: ensuredUser.id,
      userLimitPerMinute: 6,
      ipLimitPerMinute: 30,
    });

    if (!rateLimit.allowed) {
      return rateLimit.response;
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
  } catch (error) {
    return handleApiRouteError(error, "api.refresh.post");
  }
}
