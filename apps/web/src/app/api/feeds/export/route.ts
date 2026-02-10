/**
 * API Route: /api/feeds/export
 *
 * Supports two export formats:
 *   - ?format=opml (default)
 *   - ?format=json (full portable account data)
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { db, eq, users } from "@/lib/database";
import { handleApiRouteError } from "@/lib/api-errors";
import { ensureUserRecord } from "@/lib/app-user";
import { isMissingRelationError } from "@/lib/db-compat";
import { resolveFeedFolderIds } from "@/lib/folder-memberships";

/**
 * Escape XML-sensitive characters for OPML output.
 */
function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function getMembershipFolderIds(feed: unknown): string[] {
  const candidate = feed as { folderMemberships?: Array<{ folderId: string }> };
  if (!Array.isArray(candidate.folderMemberships)) {
    return [];
  }

  return candidate.folderMemberships.map((membership) => membership.folderId);
}

/**
 * Build OPML for feeds grouped by folder assignment.
 */
function buildFolderAwareOpml(params: {
  nowIso: string;
  folders: Array<{ id: string; name: string }>;
  feeds: Array<{
    url: string;
    title: string | null;
    customTitle: string | null;
    folderIds: string[];
  }>;
}): string {
  const sortedFolders = [...params.folders].sort((a, b) =>
    a.name.localeCompare(b.name)
  );

  const sortedFeeds = [...params.feeds].sort((a, b) => {
    const aLabel = a.customTitle || a.title || a.url;
    const bLabel = b.customTitle || b.title || b.url;
    return aLabel.localeCompare(bLabel);
  });

  const feedsByFolder = new Map<string, typeof sortedFeeds>();
  const uncategorized: typeof sortedFeeds = [];

  for (const feed of sortedFeeds) {
    if (feed.folderIds.length === 0) {
      uncategorized.push(feed);
      continue;
    }

    for (const folderId of feed.folderIds) {
      const existing = feedsByFolder.get(folderId) ?? [];
      existing.push(feed);
      feedsByFolder.set(folderId, existing);
    }
  }

  const uncategorizedOutlines = uncategorized
    .map((feed) => {
      const title = escapeXml(feed.customTitle || feed.title || feed.url);
      const url = escapeXml(feed.url);
      return `    <outline text="${title}" title="${title}" type="rss" xmlUrl="${url}" htmlUrl="${url}" />`;
    })
    .join("\n");

  const folderBlocks = sortedFolders
    .map((folder) => {
      const folderFeeds = feedsByFolder.get(folder.id) ?? [];
      if (folderFeeds.length === 0) {
        return "";
      }

      const folderName = escapeXml(folder.name);
      const feedOutlines = folderFeeds
        .map((feed) => {
          const title = escapeXml(feed.customTitle || feed.title || feed.url);
          const url = escapeXml(feed.url);
          return `      <outline text="${title}" title="${title}" type="rss" xmlUrl="${url}" htmlUrl="${url}" />`;
        })
        .join("\n");

      return `    <outline text="${folderName}" title="${folderName}">\n${feedOutlines}\n    </outline>`;
    })
    .filter(Boolean)
    .join("\n");

  const bodyLines = [uncategorizedOutlines, folderBlocks]
    .filter((block) => block.trim().length > 0)
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<opml version="2.0">
  <head>
    <title>FeedMyOwl Export</title>
    <dateCreated>${params.nowIso}</dateCreated>
  </head>
  <body>
${bodyLines}
  </body>
</opml>
`;
}

/**
 * GET /api/feeds/export
 * Returns OPML or JSON portable data for the authenticated user.
 */
export async function GET(request: NextRequest) {
  try {
    const { clerkId } = await requireAuth();
    const ensuredUser = await ensureUserRecord(clerkId);

    if (!ensuredUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    let user: Record<string, unknown> | null = null;

    try {
      user = (await db.query.users.findFirst({
        where: eq(users.id, ensuredUser.id),
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
      })) as Record<string, unknown> | null;
    } catch (error) {
      if (!isMissingRelationError(error, "feed_folder_memberships")) {
        throw error;
      }

      user = (await db.query.users.findFirst({
        where: eq(users.id, ensuredUser.id),
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
            },
          },
        },
      })) as Record<string, unknown> | null;
    }

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const folderRows =
      (user.folders as
        | Array<{
            id: string;
            name: string;
            createdAt: Date;
            updatedAt: Date;
          }>
        | undefined) ?? [];

    const feedRows =
      (user.feeds as
        | Array<{
            id: string;
            url: string;
            title: string | null;
            customTitle: string | null;
            description: string | null;
            folderId: string | null;
            lastFetchedAt: Date | null;
            createdAt: Date;
            updatedAt: Date;
            items: Array<{
              id: string;
              guid: string | null;
              title: string | null;
              link: string | null;
              author: string | null;
              publishedAt: Date | null;
              readAt: Date | null;
              createdAt: Date;
              updatedAt: Date;
            }>;
            folderMemberships?: Array<{ folderId: string }>;
          }>
        | undefined) ?? [];

    const format = request.nextUrl.searchParams.get("format") || "opml";
    const nowIso = new Date().toISOString();
    const filenameDate = nowIso.slice(0, 10);

    if (format === "opml") {
      const opml = buildFolderAwareOpml({
        nowIso,
        folders: folderRows.map((folder) => ({
          id: folder.id,
          name: folder.name,
        })),
        feeds: feedRows.map((feed) => ({
          url: feed.url,
          title: feed.title,
          customTitle: feed.customTitle,
          folderIds: resolveFeedFolderIds({
            legacyFolderId: feed.folderId,
            membershipFolderIds: getMembershipFolderIds(feed),
          }),
        })),
      });

      return new NextResponse(opml, {
        status: 200,
        headers: {
          "Content-Type": "text/x-opml; charset=utf-8",
          "Content-Disposition": `attachment; filename="feedmyowl-feeds-${filenameDate}.opml"`,
          "Cache-Control": "no-store",
        },
      });
    }

    if (format === "json") {
      const exportedData = {
        exportedAt: nowIso,
        user: {
          id: (user.id as string) || "",
          clerkId: (user.clerkId as string) || "",
          email: (user.email as string) || "",
          createdAt: (user.createdAt as Date).toISOString(),
        },
        folders: folderRows
          .map((folder) => ({
            id: folder.id,
            name: folder.name,
            createdAt: folder.createdAt.toISOString(),
            updatedAt: folder.updatedAt.toISOString(),
          }))
          .sort((a, b) => a.name.localeCompare(b.name)),
        feeds: feedRows
          .map((feed) => ({
            id: feed.id,
            url: feed.url,
            title: feed.title,
            customTitle: feed.customTitle,
            description: feed.description,
            folderIds: resolveFeedFolderIds({
              legacyFolderId: feed.folderId,
              membershipFolderIds: getMembershipFolderIds(feed),
            }),
            // Transitional compatibility for older imports.
            folderId: feed.folderId,
            lastFetchedAt: feed.lastFetchedAt?.toISOString() || null,
            createdAt: feed.createdAt.toISOString(),
            updatedAt: feed.updatedAt.toISOString(),
            items: feed.items.map((item) => ({
              id: item.id,
              guid: item.guid,
              title: item.title,
              link: item.link,
              author: item.author,
              publishedAt: item.publishedAt?.toISOString() || null,
              readAt: item.readAt?.toISOString() || null,
              createdAt: item.createdAt.toISOString(),
              updatedAt: item.updatedAt.toISOString(),
            })),
          }))
          .sort((a, b) => {
            const aLabel = a.customTitle || a.title || a.url;
            const bLabel = b.customTitle || b.title || b.url;
            return aLabel.localeCompare(bLabel);
          }),
      };

      return new NextResponse(JSON.stringify(exportedData, null, 2), {
        status: 200,
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          "Content-Disposition": `attachment; filename="feedmyowl-data-${filenameDate}.json"`,
          "Cache-Control": "no-store",
        },
      });
    }

    return NextResponse.json(
      { error: "Unsupported export format" },
      { status: 400 }
    );
  } catch (error) {
    return handleApiRouteError(error, "api.feeds.export.get");
  }
}
