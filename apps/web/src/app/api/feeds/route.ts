/**
 * API Route: /api/feeds
 *
 * Handles feed, folder, and item read-state operations for the authenticated user.
 *
 * Supported operations:
 *   - GET /api/feeds
 *   - POST /api/feeds with action payloads
 *   - PATCH /api/feeds with action payloads
 *
 * Route-surface note:
 * We intentionally keep these actions under the existing route instead of
 * introducing new endpoints, to preserve MVP route shape.
 */

import { NextRequest, NextResponse } from "next/server";
import {
  and,
  db,
  eq,
  feedItems,
  feeds,
  folders,
  users,
} from "@/lib/database";
import { requireAuth } from "@/lib/auth";
import { ensureUserRecord } from "@/lib/app-user";

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
 * Resolve the currently authenticated application user row.
 */
async function getAppUser() {
  const { clerkId } = await requireAuth();
  return await ensureUserRecord(clerkId);
}

/**
 * GET /api/feeds
 * Returns folders and feeds for the authenticated user.
 */
export async function GET() {
  try {
    const appUser = await getAppUser();

    if (!appUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const user = await db.query.users.findFirst({
      where: eq(users.id, appUser.id),
      with: {
        folders: true,
        feeds: {
          with: {
            items: true,
          },
        },
      },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json({ folders: user.folders, feeds: user.feeds });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

/**
 * POST /api/feeds
 *
 * Supported actions:
 *   - feed.create (and legacy { url } payload)
 *   - folder.create
 */
export async function POST(request: NextRequest) {
  try {
    const appUser = await getAppUser();

    if (!appUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const payload = await parseRequestJson(request);
    if (!payload) {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const rawAction = payload.action;

    // Backward compatibility: when action is omitted but `url` exists,
    // treat it as feed.create.
    const action =
      typeof rawAction === "string"
        ? rawAction
        : typeof payload.url === "string"
          ? "feed.create"
          : null;

    if (action === "folder.create") {
      const name = payload.name;
      const nextName = typeof name === "string" ? name.trim() : "";

      if (!nextName) {
        return NextResponse.json(
          { error: "Folder name is required" },
          { status: 400 }
        );
      }

      const [newFolder] = await db
        .insert(folders)
        .values({
          userId: appUser.id,
          name: nextName,
        })
        .returning();

      return NextResponse.json({ folder: newFolder }, { status: 201 });
    }

    if (action === "feed.create") {
      const url = payload.url;
      const folderId = payload.folderId;
      const nextUrl = typeof url === "string" ? url.trim() : "";

      if (!nextUrl) {
        return NextResponse.json(
          { error: "Feed URL is required" },
          { status: 400 }
        );
      }

      let validatedFolderId: string | null = null;
      if (folderId !== undefined && folderId !== null) {
        if (typeof folderId !== "string" || !folderId.trim()) {
          return NextResponse.json(
            { error: "Invalid folder ID" },
            { status: 400 }
          );
        }

        const folder = await db.query.folders.findFirst({
          where: and(eq(folders.id, folderId), eq(folders.userId, appUser.id)),
        });

        if (!folder) {
          return NextResponse.json({ error: "Folder not found" }, { status: 404 });
        }

        validatedFolderId = folder.id;
      }

      const [newFeed] = await db
        .insert(feeds)
        .values({
          userId: appUser.id,
          folderId: validatedFolderId,
          url: nextUrl,
        })
        .returning();

      return NextResponse.json({ feed: newFeed }, { status: 201 });
    }

    return NextResponse.json({ error: "Unsupported action" }, { status: 400 });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

/**
 * PATCH /api/feeds
 *
 * Supported actions:
 *   - folder.rename
 *   - folder.delete
 *   - item.markRead
 */
export async function PATCH(request: NextRequest) {
  try {
    const appUser = await getAppUser();

    if (!appUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const payload = await parseRequestJson(request);
    if (!payload || typeof payload.action !== "string") {
      return NextResponse.json(
        { error: "Action is required" },
        { status: 400 }
      );
    }

    if (payload.action === "folder.rename") {
      const folderId = payload.folderId;
      const name = payload.name;
      const nextName = typeof name === "string" ? name.trim() : "";

      if (typeof folderId !== "string" || !folderId.trim()) {
        return NextResponse.json({ error: "Folder ID is required" }, { status: 400 });
      }

      if (!nextName) {
        return NextResponse.json(
          { error: "Folder name is required" },
          { status: 400 }
        );
      }

      const [renamedFolder] = await db
        .update(folders)
        .set({
          name: nextName,
          updatedAt: new Date(),
        })
        .where(and(eq(folders.id, folderId), eq(folders.userId, appUser.id)))
        .returning();

      if (!renamedFolder) {
        return NextResponse.json({ error: "Folder not found" }, { status: 404 });
      }

      return NextResponse.json({ folder: renamedFolder });
    }

    if (payload.action === "folder.delete") {
      const folderId = payload.folderId;

      if (typeof folderId !== "string" || !folderId.trim()) {
        return NextResponse.json({ error: "Folder ID is required" }, { status: 400 });
      }

      const [deletedFolder] = await db
        .delete(folders)
        .where(and(eq(folders.id, folderId), eq(folders.userId, appUser.id)))
        .returning({ id: folders.id });

      if (!deletedFolder) {
        return NextResponse.json({ error: "Folder not found" }, { status: 404 });
      }

      return NextResponse.json({ success: true, folderId: deletedFolder.id });
    }

    if (payload.action === "item.markRead") {
      const itemId = payload.itemId;

      if (typeof itemId !== "string" || !itemId.trim()) {
        return NextResponse.json({ error: "Item ID is required" }, { status: 400 });
      }

      const item = await db.query.feedItems.findFirst({
        where: eq(feedItems.id, itemId),
        with: {
          feed: {
            columns: {
              id: true,
              userId: true,
            },
          },
        },
      });

      if (!item || item.feed.userId !== appUser.id) {
        return NextResponse.json({ error: "Article not found" }, { status: 404 });
      }

      if (item.readAt) {
        return NextResponse.json({
          itemId: item.id,
          readAt: item.readAt.toISOString(),
          alreadyRead: true,
        });
      }

      const now = new Date();
      await db
        .update(feedItems)
        .set({ readAt: now, updatedAt: now })
        .where(eq(feedItems.id, item.id));

      return NextResponse.json({ itemId: item.id, readAt: now.toISOString() });
    }

    return NextResponse.json({ error: "Unsupported action" }, { status: 400 });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
