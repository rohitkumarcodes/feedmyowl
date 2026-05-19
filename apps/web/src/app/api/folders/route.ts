/**
 * API Route: /api/folders
 *
 * Handles folder creation for authenticated users.
 */

import { NextRequest, NextResponse } from "next/server";
import { handleApiRouteError } from "@/lib/server/api-errors";
import { parseRequestJson } from "@/lib/server/http/request-json";
import {
  createFolder,
  FOLDER_LIMIT,
  FOLDER_NAME_MAX_LENGTH,
} from "@/lib/server/folder-service";
import type { FolderCreateResponseBody } from "@/contracts/api/folders";

function toIsoString(value: Date | string | null | undefined): string | null {
  if (!value) {
    return null;
  }

  return typeof value === "string" ? value : value.toISOString();
}

/**
 * POST /api/folders
 * Create one folder for the authenticated user.
 */
export async function POST(request: NextRequest) {
  try {
    const payload = await parseRequestJson(request);
    const name = payload?.name;

    if (typeof name !== "string") {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }

    const result = await createFolder(name);

    if (result.status === "invalid_name") {
      return NextResponse.json(
        {
          error: `Folder name must be 1-${FOLDER_NAME_MAX_LENGTH} characters.`,
          code: "invalid_name",
        },
        { status: 400 },
      );
    }

    if (result.status === "folder_limit_reached") {
      return NextResponse.json(
        {
          error: `You can have up to ${FOLDER_LIMIT} folders.`,
          code: "folder_limit_reached",
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

    return NextResponse.json({ folder } satisfies FolderCreateResponseBody, {
      status: 201,
    });
  } catch (error) {
    return handleApiRouteError(error, "api.folders.post");
  }
}
