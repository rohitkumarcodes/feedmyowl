import { NextResponse } from "next/server";
import { db, eq, users } from "@/lib/database";
import { handleApiRouteError } from "@/lib/api-errors";
import {
  getFeedMembershipFolderIds,
  resolveFeedFolderIds,
} from "@/lib/folder-memberships";
import { purgeOldFeedItemsForUser } from "@/lib/retention";
import { getAppUser } from "./route.shared";

/**
 * GET /api/feeds
 * Returns feeds for the authenticated user.
 */
export async function getFeedsRoute() {
  try {
    const appUser = await getAppUser();

    if (!appUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Keep 50-items-per-feed cap enforced even during read-heavy sessions.
    await purgeOldFeedItemsForUser(appUser.id);

    const user = (await db.query.users.findFirst({
      where: eq(users.id, appUser.id),
      columns: {
        id: true,
        clerkId: true,
        email: true,
        subscriptionTier: true,
        stripeCustomerId: true,
        stripeSubscriptionId: true,
        createdAt: true,
        updatedAt: true,
      },
      with: {
        folders: true,
        feeds: {
          with: {
            items: true,
            folderMemberships: {
              columns: {
                folderId: true,
              },
            },
          },
        },
      },
    })) as
      | {
          folders?: Array<{
            id: string;
            name: string;
            createdAt: Date;
            updatedAt: Date;
          }>;
          feeds?: Array<{
            id: string;
            userId: string;
            url: string;
            title: string | null;
            customTitle: string | null;
            description: string | null;
            lastFetchedAt: Date | null;
            lastFetchStatus: string | null;
            lastFetchErrorCode: string | null;
            lastFetchErrorMessage: string | null;
            lastFetchErrorAt: Date | null;
            createdAt: Date;
            updatedAt: Date;
            items: Array<{
              id: string;
              feedId: string;
              guid: string | null;
              title: string | null;
              link: string | null;
              content: string | null;
              author: string | null;
              publishedAt: Date | null;
              readAt: Date | null;
              createdAt: Date;
              updatedAt: Date;
            }>;
            folderMemberships?: Array<{ folderId: string }>;
          }>;
        }
      | null;

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const folderRows = user.folders ?? [];
    const feedRows = user.feeds ?? [];

    const responseFeeds = feedRows.map((feed) => ({
      id: feed.id,
      userId: feed.userId,
      url: feed.url,
      title: feed.title,
      customTitle: feed.customTitle,
      description: feed.description,
      lastFetchedAt: feed.lastFetchedAt,
      lastFetchStatus: feed.lastFetchStatus,
      lastFetchErrorCode: feed.lastFetchErrorCode,
      lastFetchErrorMessage: feed.lastFetchErrorMessage,
      lastFetchErrorAt: feed.lastFetchErrorAt,
      createdAt: feed.createdAt,
      updatedAt: feed.updatedAt,
      items: feed.items,
      folderIds: resolveFeedFolderIds(getFeedMembershipFolderIds(feed)),
    }));

    return NextResponse.json({ feeds: responseFeeds, folders: folderRows });
  } catch (error) {
    return handleApiRouteError(error, "api.feeds.get");
  }
}
