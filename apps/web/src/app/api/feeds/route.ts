/**
 * API Route: /api/feeds
 *
 * Handles feed creation, article read/extraction actions, and account deletion
 * for the authenticated user while keeping the surface area minimal.
 */

import { NextRequest, NextResponse } from "next/server";
import { db, eq, users } from "@/lib/database";
import { deleteAuthUser, requireAuth } from "@/lib/auth";
import { ensureUserRecord } from "@/lib/app-user";
import { parseFeed } from "@/lib/feed-parser";
import { purgeOldFeedItemsForUser } from "@/lib/retention";
import { normalizeFeedError } from "@/lib/feed-errors";
import { normalizeFeedUrl } from "@/lib/feed-url";
import {
  createFeedWithInitialItems,
  extractFeedItemForUser,
  findExistingFeedForUserByUrl,
  markFeedItemReadForUser,
} from "@/lib/feed-service";

interface ApiError {
  error: string;
  code?: string;
}

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
 * Returns feeds for the authenticated user.
 */
export async function GET() {
  try {
    const appUser = await getAppUser();

    if (!appUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Keep retention policy enforced even during read-heavy sessions.
    await purgeOldFeedItemsForUser(appUser.id);

    const user = await db.query.users.findFirst({
      where: eq(users.id, appUser.id),
      with: {
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

    return NextResponse.json({ feeds: user.feeds });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

/**
 * POST /api/feeds
 *
 * Supported actions:
 *   - feed.create (and legacy { url } payload)
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

    if (action !== "feed.create") {
      return NextResponse.json({ error: "Unsupported action" }, { status: 400 });
    }

    const nextUrl = normalizeFeedUrl(payload.url);

    if (!nextUrl) {
      return NextResponse.json(
        {
          error: "This URL does not appear to be valid.",
          code: "invalid_url",
        } satisfies ApiError,
        { status: 400 }
      );
    }

    const existingFeed = await findExistingFeedForUserByUrl(appUser.id, nextUrl);

    if (existingFeed) {
      return NextResponse.json({
        feed: existingFeed,
        duplicate: true,
        message: "This feed is already in your library.",
      });
    }

    let parsedFeed;
    try {
      parsedFeed = await parseFeed(nextUrl);
    } catch (error) {
      const normalizedError = normalizeFeedError(error, "create");
      return NextResponse.json(
        {
          error: normalizedError.message,
          code: normalizedError.code,
        } satisfies ApiError,
        { status: 400 }
      );
    }

    let created: Awaited<ReturnType<typeof createFeedWithInitialItems>> | null = null;
    try {
      created = await createFeedWithInitialItems(appUser.id, nextUrl, parsedFeed);
    } catch {
      const raceExistingFeed = await findExistingFeedForUserByUrl(appUser.id, nextUrl);

      if (raceExistingFeed) {
        return NextResponse.json({
          feed: raceExistingFeed,
          duplicate: true,
          message: "This feed is already in your library.",
        });
      }

      return NextResponse.json(
        { error: "Could not add this feed right now." },
        { status: 500 }
      );
    }

    if (!created) {
      return NextResponse.json(
        { error: "Could not add this feed right now." },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        feed: created.feed,
        importedItemCount: created.insertedItems,
        duplicate: false,
      },
      { status: 201 }
    );
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

/**
 * PATCH /api/feeds
 *
 * Supported actions:
 *   - item.markRead
 *   - item.extractFull
 *   - account.delete
 */
export async function PATCH(request: NextRequest) {
  try {
    const appUser = await getAppUser();

    if (!appUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const payload = await parseRequestJson(request);
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
        });
      }

      return NextResponse.json({ itemId: result.itemId, readAt: result.readAt });
    }

    if (payload.action === "item.extractFull") {
      const itemId = payload.itemId;

      if (typeof itemId !== "string" || !itemId.trim()) {
        return NextResponse.json({ error: "Item ID is required" }, { status: 400 });
      }

      const result = await extractFeedItemForUser(appUser.id, itemId);

      if (result.status === "not_found") {
        return NextResponse.json({ error: "Article not found" }, { status: 404 });
      }

      return NextResponse.json(result.payload);
    }

    if (payload.action === "account.delete") {
      const confirmed = payload.confirm === true;
      if (!confirmed) {
        return NextResponse.json(
          { error: "Account deletion must be explicitly confirmed." },
          { status: 400 }
        );
      }

      try {
        await deleteAuthUser(appUser.clerkId);
      } catch {
        return NextResponse.json(
          { error: "Could not delete authentication account." },
          { status: 500 }
        );
      }

      await db.delete(users).where(eq(users.id, appUser.id));

      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "Unsupported action" }, { status: 400 });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
