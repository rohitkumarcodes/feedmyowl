/**
 * API Route: /api/feeds/[id]
 *
 * Handles operations on a specific feed:
 *   - PATCH /api/feeds/[id] — rename or move a feed
 *   - DELETE /api/feeds/[id] — unsubscribe from a feed
 *
 * Authentication is required and every mutation validates ownership.
 */

import { NextRequest, NextResponse } from "next/server";
import { and, db, eq, feeds, folders } from "@/lib/database";
import { requireAuth } from "@/lib/auth";
import { ensureUserRecord } from "@/lib/app-user";

interface FeedRenamePayload {
  action: "feed.rename";
  title?: unknown;
}

interface FeedMovePayload {
  action: "feed.move";
  folderId?: unknown;
}

/**
 * Resolve a feed owned by the authenticated user.
 */
async function getOwnedFeed(feedId: string, userId: string) {
  return await db.query.feeds.findFirst({
    where: and(eq(feeds.id, feedId), eq(feeds.userId, userId)),
  });
}

/**
 * PATCH /api/feeds/[id]
 *
 * Supported actions:
 *   - feed.rename
 *   - feed.move
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { clerkId } = await requireAuth();
    const appUser = await ensureUserRecord(clerkId);
    const { id } = await params;

    if (!appUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const feed = await getOwnedFeed(id, appUser.id);
    if (!feed) {
      return NextResponse.json({ error: "Feed not found" }, { status: 404 });
    }

    let payload: FeedRenamePayload | FeedMovePayload;
    try {
      payload = (await request.json()) as FeedRenamePayload | FeedMovePayload;
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    if (payload.action === "feed.rename") {
      const nextTitle = typeof payload.title === "string" ? payload.title.trim() : "";

      if (!nextTitle) {
        return NextResponse.json({ error: "Feed title is required" }, { status: 400 });
      }

      const [updatedFeed] = await db
        .update(feeds)
        .set({ title: nextTitle, updatedAt: new Date() })
        .where(and(eq(feeds.id, id), eq(feeds.userId, appUser.id)))
        .returning();

      return NextResponse.json({ feed: updatedFeed });
    }

    if (payload.action === "feed.move") {
      const requestedFolderId = payload.folderId;

      if (
        requestedFolderId !== null &&
        requestedFolderId !== undefined &&
        (typeof requestedFolderId !== "string" || !requestedFolderId.trim())
      ) {
        return NextResponse.json({ error: "Invalid folder ID" }, { status: 400 });
      }

      let validatedFolderId: string | null = null;
      if (typeof requestedFolderId === "string") {
        const folder = await db.query.folders.findFirst({
          where: and(
            eq(folders.id, requestedFolderId),
            eq(folders.userId, appUser.id)
          ),
        });

        if (!folder) {
          return NextResponse.json({ error: "Folder not found" }, { status: 404 });
        }

        validatedFolderId = folder.id;
      }

      const [updatedFeed] = await db
        .update(feeds)
        .set({ folderId: validatedFolderId, updatedAt: new Date() })
        .where(and(eq(feeds.id, id), eq(feeds.userId, appUser.id)))
        .returning();

      return NextResponse.json({ feed: updatedFeed });
    }

    return NextResponse.json({ error: "Unsupported action" }, { status: 400 });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

/**
 * DELETE /api/feeds/[id]
 * Unsubscribe from a feed. Only the feed owner can delete it.
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { clerkId } = await requireAuth();
    const { id } = await params;

    const user = await ensureUserRecord(clerkId);

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const deleted = await db
      .delete(feeds)
      .where(and(eq(feeds.id, id), eq(feeds.userId, user.id)))
      .returning();

    if (deleted.length === 0) {
      return NextResponse.json({ error: "Feed not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
