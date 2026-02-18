import { NextRequest, NextResponse } from "next/server";
import { db, eq, users } from "@/lib/server/database";
import { deleteAuthUser } from "@/lib/server/auth";
import { handleApiRouteError } from "@/lib/server/api-errors";
import { assertTrustedWriteOrigin } from "@/lib/server/csrf";
import type {
  AccountDeleteResponseBody,
  ItemSetSavedResponseBody,
  MarkAllReadResponseBody,
  MarkReadResponseBody,
  UncategorizedDeleteResponseBody,
  UncategorizedMoveResponseBody,
} from "@/contracts/api/feeds";
import {
  deleteUncategorizedFeedsForUser,
  markAllFeedItemsReadForUser,
  markFeedItemReadForUser,
  moveUncategorizedFeedsToFolderForUser,
  setFeedItemSavedForUser,
  type MarkAllReadScope,
} from "@/lib/server/feed-service";
import { getAppUser, parseRouteJson } from "./route.shared";

/**
 * PATCH /api/feeds
 *
 * Supported actions:
 *   - item.markRead
 *   - item.setSaved
 *   - items.markAllRead
 *   - uncategorized.delete
 *   - uncategorized.move_to_folder
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
        } satisfies MarkReadResponseBody);
      }

      return NextResponse.json({
        itemId: result.itemId,
        readAt: result.readAt,
      } satisfies MarkReadResponseBody);
    }

    if (payload.action === "item.setSaved") {
      const itemId = payload.itemId;
      const saved = payload.saved;

      if (typeof itemId !== "string" || !itemId.trim()) {
        return NextResponse.json({ error: "Item ID is required" }, { status: 400 });
      }

      if (typeof saved !== "boolean") {
        return NextResponse.json({ error: "saved must be a boolean" }, { status: 400 });
      }

      const result = await setFeedItemSavedForUser(appUser.id, itemId, saved);

      if (result.status === "not_found") {
        return NextResponse.json({ error: "Article not found" }, { status: 404 });
      }

      if (result.status === "already_set") {
        return NextResponse.json({
          itemId: result.itemId,
          savedAt: result.savedAt,
          alreadySet: true,
        } satisfies ItemSetSavedResponseBody);
      }

      return NextResponse.json({
        itemId: result.itemId,
        savedAt: result.savedAt,
      } satisfies ItemSetSavedResponseBody);
    }

    if (payload.action === "items.markAllRead") {
      const scopeType = payload.scopeType;
      if (typeof scopeType !== "string") {
        return NextResponse.json({ error: "scopeType is required." }, { status: 400 });
      }

      const validScopeTypes = [
        "all",
        "unread",
        "saved",
        "uncategorized",
        "folder",
        "feed",
      ];
      if (!validScopeTypes.includes(scopeType)) {
        return NextResponse.json({ error: "Invalid scopeType." }, { status: 400 });
      }

      let scope: MarkAllReadScope;
      if (scopeType === "folder" || scopeType === "feed") {
        const scopeId = payload.scopeId;
        if (typeof scopeId !== "string" || !scopeId.trim()) {
          return NextResponse.json(
            { error: "scopeId is required for folder and feed scopes." },
            { status: 400 },
          );
        }
        scope = { type: scopeType, id: scopeId };
      } else {
        scope = { type: scopeType as "all" | "unread" | "saved" | "uncategorized" };
      }

      const result = await markAllFeedItemsReadForUser(appUser.id, scope);

      if (result.status === "scope_not_found") {
        return NextResponse.json({ error: "Scope not found." }, { status: 404 });
      }

      return NextResponse.json({
        success: true,
        markedCount: result.markedCount,
      } satisfies MarkAllReadResponseBody);
    }

    if (payload.action === "uncategorized.delete") {
      const confirmed = payload.confirm === true;
      if (!confirmed) {
        return NextResponse.json(
          { error: "Uncategorized deletion must be explicitly confirmed." },
          { status: 400 },
        );
      }

      const deletedFeedCount = await deleteUncategorizedFeedsForUser(appUser.id);
      return NextResponse.json({
        success: true,
        deletedFeedCount,
      } satisfies UncategorizedDeleteResponseBody);
    }

    if (payload.action === "uncategorized.move_to_folder") {
      const folderId = payload.folderId;

      if (typeof folderId !== "string" || !folderId.trim()) {
        return NextResponse.json(
          {
            error: "Folder ID is required.",
            code: "invalid_folder_id",
          },
          { status: 400 },
        );
      }

      const result = await moveUncategorizedFeedsToFolderForUser(appUser.id, folderId);

      if (result.status === "invalid_folder_id") {
        return NextResponse.json(
          {
            error: "Selected folder could not be found.",
            code: "invalid_folder_id",
          },
          { status: 400 },
        );
      }

      return NextResponse.json({
        success: true,
        totalUncategorizedCount: result.totalUncategorizedCount,
        movedFeedCount: result.movedFeedCount,
        failedFeedCount: result.failedFeedCount,
      } satisfies UncategorizedMoveResponseBody);
    }

    if (payload.action === "account.delete") {
      const confirmed = payload.confirm === true;
      if (!confirmed) {
        return NextResponse.json(
          { error: "Account deletion must be explicitly confirmed." },
          { status: 400 },
        );
      }

      try {
        await deleteAuthUser(appUser.clerkId);
      } catch {
        return NextResponse.json(
          { error: "Could not delete authentication account." },
          { status: 500 },
        );
      }

      await db.delete(users).where(eq(users.id, appUser.id));

      return NextResponse.json({ success: true } satisfies AccountDeleteResponseBody);
    }

    return NextResponse.json({ error: "Unsupported action" }, { status: 400 });
  } catch (error) {
    return handleApiRouteError(error, "api.feeds.patch");
  }
}
