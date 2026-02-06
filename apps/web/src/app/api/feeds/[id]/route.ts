/**
 * API Route: /api/feeds/[id]
 *
 * Handles operations on a specific feed:
 *   DELETE /api/feeds/[id] — Unsubscribe from a feed
 *
 * Authentication is required. Users can only delete their own feeds.
 * Cascade delete in the database schema automatically removes
 * all feed_items when a feed is deleted.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { db, and, eq, feeds } from "@/lib/database";
import { ensureUserRecord } from "@/lib/app-user";

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

    // Delete the feed (only if it belongs to this user)
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
