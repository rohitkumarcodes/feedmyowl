/**
 * API Route: /api/folders/[id]
 *
 * Handles folder rename and deletion for authenticated users.
 */

import { NextRequest, NextResponse } from "next/server";
import { handleApiRouteError } from "@/lib/server/api-errors";
import { parseRequestJson } from "@/lib/server/http/request-json";
import {
  deleteFolder,
  FOLDER_NAME_MAX_LENGTH,
  renameFolder,
  type DeleteFolderMode,
} from "@/lib/server/folder-service";
import type {
  FolderDeleteResponseBody,
  FolderRenameResponseBody,
} from "@/contracts/api/folders";

function toIsoString(value: Date | string | null | undefined): string | null {
  if (!value) {
    return null;
  }

  return typeof value === "string" ? value : value.toISOString();
}

/**
 * PATCH /api/folders/[id]
 * Rename one folder for the authenticated user.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const payload = await parseRequestJson(request);
    const name = payload?.name;

    if (typeof name !== "string") {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }

    const result = await renameFolder(id, name);

    if (result.status === "not_found") {
      return NextResponse.json({ error: "Folder not found" }, { status: 404 });
    }

    if (result.status === "invalid_name") {
      return NextResponse.json(
        {
          error: `Folder name must be 1-${FOLDER_NAME_MAX_LENGTH} characters.`,
          code: "invalid_name",
        },
        { status: 400 },
      );
    }

    if (result.status === "reserved_name") {
      return NextResponse.json(
        {
          error: "This name is reserved. Please choose a different folder name.",
          code: "reserved_name",
        },
        { status: 400 },
      );
    }

    if (result.status === "duplicate_name") {
      return NextResponse.json(
        {
          error: "A folder with this name already exists.",
          code: "duplicate_name",
        },
        { status: 409 },
      );
    }

    const fallbackCreatedAt = new Date().toISOString();
    const folder = {
      ...result.folder,
      createdAt: toIsoString(result.folder.createdAt) ?? fallbackCreatedAt,
      updatedAt: toIsoString(result.folder.updatedAt) ?? fallbackCreatedAt,
    };

    return NextResponse.json({ folder } satisfies FolderRenameResponseBody);
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
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
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
        { status: 400 },
      );
    }

    const result = await deleteFolder(id, mode);

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
    } satisfies FolderDeleteResponseBody);
  } catch (error) {
    return handleApiRouteError(error, "api.folders.id.delete");
  }
}
