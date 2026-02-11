/**
 * API Route: /api/feeds/[id]
 *
 * Handles renaming and unsubscribing from a specific feed.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { handleApiRouteError } from "@/lib/api-errors";
import { ensureUserRecord } from "@/lib/app-user";
import { assertTrustedWriteOrigin } from "@/lib/csrf";
import { parseRequestJson } from "@/lib/http/request-json";
import {
  deleteFeedForUser,
  renameFeedForUser,
  setFeedFoldersForUser,
} from "@/lib/feed-service";

const FEED_CUSTOM_TITLE_MAX_LENGTH = 255;

/**
 * PATCH /api/feeds/[id]
 * Rename a feed for the authenticated user.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const csrfFailure = assertTrustedWriteOrigin(request, "api.feeds.id.patch");
    if (csrfFailure) {
      return csrfFailure;
    }

    const { clerkId } = await requireAuth();
    const { id } = await params;
    const user = await ensureUserRecord(clerkId);

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const payload = await parseRequestJson(request);
    if (payload?.action === "feed.setFolders") {
      const folderIds = payload.folderIds;

      if (!Array.isArray(folderIds) || !folderIds.every((value) => typeof value === "string")) {
        return NextResponse.json(
          {
            error: "folderIds must be an array of folder IDs.",
            code: "invalid_folder_ids",
          },
          { status: 400 }
        );
      }

      const result = await setFeedFoldersForUser(user.id, id, folderIds);

      if (result.status === "feed_not_found") {
        return NextResponse.json({ error: "Feed not found" }, { status: 404 });
      }

      if (result.status === "invalid_folder_ids") {
        return NextResponse.json(
          {
            error: "One or more selected folders could not be found.",
            code: "invalid_folder_ids",
            invalidFolderIds: result.invalidFolderIds,
          },
          { status: 400 }
        );
      }

      return NextResponse.json({
        feed: {
          id,
          folderIds: result.folderIds,
        },
      });
    }

    const nextName = payload?.name;

    if (typeof nextName !== "string") {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }

    const trimmedName = nextName.trim();
    if (trimmedName.length > FEED_CUSTOM_TITLE_MAX_LENGTH) {
      return NextResponse.json(
        {
          error: `Name must be ${FEED_CUSTOM_TITLE_MAX_LENGTH} characters or fewer.`,
          code: "name_too_long",
        },
        { status: 400 }
      );
    }

    const updatedFeed = await renameFeedForUser(
      user.id,
      id,
      trimmedName.length > 0 ? trimmedName : null
    );

    if (!updatedFeed) {
      return NextResponse.json({ error: "Feed not found" }, { status: 404 });
    }

    return NextResponse.json({ feed: updatedFeed });
  } catch (error) {
    return handleApiRouteError(error, "api.feeds.id.patch");
  }
}

/**
 * DELETE /api/feeds/[id]
 * Unsubscribe from a feed. Only the feed owner can delete it.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const csrfFailure = assertTrustedWriteOrigin(request, "api.feeds.id.delete");
    if (csrfFailure) {
      return csrfFailure;
    }

    const { clerkId } = await requireAuth();
    const { id } = await params;

    const user = await ensureUserRecord(clerkId);

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const deleted = await deleteFeedForUser(user.id, id);

    if (!deleted) {
      return NextResponse.json({ error: "Feed not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiRouteError(error, "api.feeds.id.delete");
  }
}
