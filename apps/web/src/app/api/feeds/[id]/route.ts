/**
 * API Route: /api/feeds/[id]
 *
 * Handles unsubscribing from a specific feed.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { ensureUserRecord } from "@/lib/app-user";
import { deleteFeedForUser } from "@/lib/feed-service";

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

    const deleted = await deleteFeedForUser(user.id, id);

    if (!deleted) {
      return NextResponse.json({ error: "Feed not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
