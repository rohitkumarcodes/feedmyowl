/**
 * API Route: /api/folders
 *
 * Handles folder creation for authenticated users.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { handleApiRouteError } from "@/lib/api-errors";
import { ensureUserRecord } from "@/lib/app-user";
import { assertTrustedWriteOrigin } from "@/lib/csrf";
import {
  createFolderForUser,
  FOLDER_NAME_MAX_LENGTH,
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
 * POST /api/folders
 * Create one folder for the authenticated user.
 */
export async function POST(request: NextRequest) {
  try {
    const csrfFailure = assertTrustedWriteOrigin(request, "api.folders.post");
    if (csrfFailure) {
      return csrfFailure;
    }

    const { clerkId } = await requireAuth();
    const user = await ensureUserRecord(clerkId);

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const payload = await parseRequestJson(request);
    const name = payload?.name;

    if (typeof name !== "string") {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }

    const result = await createFolderForUser(user.id, name);

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

    return NextResponse.json({ folder: result.folder }, { status: 201 });
  } catch (error) {
    return handleApiRouteError(error, "api.folders.post");
  }
}
