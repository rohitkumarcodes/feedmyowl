import { NextRequest, NextResponse } from "next/server";
import { db, eq, users } from "@/lib/database";
import { deleteAuthUser } from "@/lib/auth";
import { handleApiRouteError } from "@/lib/api-errors";
import { assertTrustedWriteOrigin } from "@/lib/csrf";
import { markFeedItemReadForUser } from "@/lib/feed-service";
import { getAppUser, parseRouteJson } from "./route.shared";

/**
 * PATCH /api/feeds
 *
 * Supported actions:
 *   - item.markRead
 *   - account.delete
 */
export async function patchFeedsRoute(request: NextRequest) {
  try {
    const csrfFailure = assertTrustedWriteOrigin(request, "api.feeds.patch");
    if (csrfFailure) {
      return csrfFailure;
    }

    const appUser = await getAppUser();

    if (!appUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const payload = await parseRouteJson(request);
    if (!payload || typeof payload.action !== "string") {
      return NextResponse.json({ error: "Action is required" }, { status: 400 });
    }

    if (payload.action === "item.markRead") {
      const itemId = payload.itemId;

      if (typeof itemId !== "string" || !itemId.trim()) {
        return NextResponse.json({ error: "Item ID is required" }, { status: 400 });
      }

      const result = await markFeedItemReadForUser(appUser.id, itemId);

      if (result.status === "not_found") {
        return NextResponse.json({ error: "Article not found" }, { status: 404 });
      }

      if (result.status === "already_read") {
        return NextResponse.json({
          itemId: result.itemId,
          readAt: result.readAt,
          alreadyRead: true,
        });
      }

      return NextResponse.json({ itemId: result.itemId, readAt: result.readAt });
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
  } catch (error) {
    return handleApiRouteError(error, "api.feeds.patch");
  }
}
