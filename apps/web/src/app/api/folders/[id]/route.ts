/**
 * API Route: /api/folders/[id]
 *
 * Handles folder rename and deletion for authenticated users.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { handleApiRouteError } from "@/lib/api-errors";
import { ensureUserRecord } from "@/lib/app-user";
import { assertTrustedWriteOrigin } from "@/lib/csrf";
import {
  deleteFolderForUser,
  FOLDER_NAME_MAX_LENGTH,
  renameFolderForUser,
  type DeleteFolderMode,
} from "@/lib/folder-service";

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
 * PATCH /api/folders/[id]
 * Rename one folder for the authenticated user.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const csrfFailure = assertTrustedWriteOrigin(request, "api.folders.id.patch");
    if (csrfFailure) {
      return csrfFailure;
    }

    const { clerkId } = await requireAuth();
    const user = await ensureUserRecord(clerkId);
    const { id } = await params;

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const payload = await parseRequestJson(request);
    const name = payload?.name;

    if (typeof name !== "string") {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }

    const result = await renameFolderForUser(user.id, id, name);

    if (result.status === "not_found") {
      return NextResponse.json({ error: "Folder not found" }, { status: 404 });
    }

    if (result.status === "invalid_name") {
      return NextResponse.json(
        {
          error: `Folder name must be 1-${FOLDER_NAME_MAX_LENGTH} characters.`,
          code: "invalid_name",
        },
        { status: 400 }
      );
    }

    if (result.status === "duplicate_name") {
      return NextResponse.json(
        {
          error: "A folder with this name already exists.",
          code: "duplicate_name",
        },
        { status: 409 }
      );
    }

    return NextResponse.json({ folder: result.folder });
  } catch (error) {
    return handleApiRouteError(error, "api.folders.id.patch");
  }
}

/**
 * DELETE /api/folders/[id]
 * Delete one folder for the authenticated user.
 *
 * Modes:
 *   - remove_only
 *   - remove_and_unsubscribe_exclusive
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const csrfFailure = assertTrustedWriteOrigin(request, "api.folders.id.delete");
    if (csrfFailure) {
      return csrfFailure;
    }

    const { clerkId } = await requireAuth();
    const user = await ensureUserRecord(clerkId);
    const { id } = await params;

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const modeParam = request.nextUrl.searchParams.get("mode");
    const mode: DeleteFolderMode =
      modeParam === "remove_and_unsubscribe_exclusive"
        ? "remove_and_unsubscribe_exclusive"
        : "remove_only";

    if (
      modeParam &&
      modeParam !== "remove_only" &&
      modeParam !== "remove_and_unsubscribe_exclusive"
    ) {
      return NextResponse.json(
        {
          error: "Invalid delete mode.",
          code: "invalid_mode",
        },
        { status: 400 }
      );
    }

    const result = await deleteFolderForUser(user.id, id, mode);

    if (result.status === "not_found") {
      return NextResponse.json({ error: "Folder not found" }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      mode: result.mode,
      totalFeeds: result.totalFeeds,
      exclusiveFeeds: result.exclusiveFeeds,
      crossListedFeeds: result.crossListedFeeds,
      unsubscribedFeeds: result.unsubscribedFeeds,
    });
  } catch (error) {
    return handleApiRouteError(error, "api.folders.id.delete");
  }
}
