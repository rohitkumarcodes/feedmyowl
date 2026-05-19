import { NextResponse } from "next/server";
import { db } from "@/lib/server/database";
import { handleApiRouteError } from "@/lib/server/api-errors";
import {
  getFeedMembershipFolderIds,
  resolveFeedFolderIds,
} from "@/lib/shared/folder-memberships";
import type { FeedsGetResponseBody } from "@/contracts/api/feeds";

export async function getFeedsRoute() {
  try {
    const [allFeeds, allFolders] = await Promise.all([
      db.query.feeds.findMany({
        with: {
          items: {
            columns: {
              id: true,
              feedId: true,
              guid: true,
              title: true,
              link: true,
              content: true,
              author: true,
              publishedAt: true,
              readAt: true,
              savedAt: true,
              createdAt: true,
              updatedAt: true,
            },
          },
          folderMemberships: {
            columns: {
              folderId: true,
            },
          },
        },
      }),
      db.query.folders.findMany({
        columns: {
          id: true,
          name: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
    ]);

    const responseFolders = allFolders.map((folder) => ({
      id: folder.id,
      name: folder.name,
      createdAt: folder.createdAt.toISOString(),
      updatedAt: folder.updatedAt.toISOString(),
    }));

    const responseFeeds = allFeeds.map((feed) => ({
      id: feed.id,
      url: feed.url,
      title: feed.title,
      customTitle: feed.customTitle,
      description: feed.description,
      lastFetchedAt: feed.lastFetchedAt?.toISOString() ?? null,
      lastFetchStatus: feed.lastFetchStatus,
      lastFetchErrorCode: feed.lastFetchErrorCode,
      lastFetchErrorMessage: feed.lastFetchErrorMessage,
      lastFetchErrorAt: feed.lastFetchErrorAt?.toISOString() ?? null,
      createdAt: feed.createdAt.toISOString(),
      updatedAt: feed.updatedAt.toISOString(),
      items: feed.items.map((item) => ({
        ...item,
        publishedAt: item.publishedAt?.toISOString() ?? null,
        readAt: item.readAt?.toISOString() ?? null,
        savedAt: item.savedAt?.toISOString() ?? null,
        createdAt: item.createdAt.toISOString(),
        updatedAt: item.updatedAt.toISOString(),
      })),
      folderIds: resolveFeedFolderIds(getFeedMembershipFolderIds(feed)),
    }));

    return NextResponse.json({
      feeds: responseFeeds,
      folders: responseFolders,
    } satisfies FeedsGetResponseBody);
  } catch (error) {
    return handleApiRouteError(error, "api.feeds.get");
  }
}
