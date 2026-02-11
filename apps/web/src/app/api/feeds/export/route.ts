/**
 * API Route: /api/feeds/export
 *
 * Supported formats:
 *   - ?format=opml (default)
 *   - ?format=json (portable v2)
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { db, eq, users } from "@/lib/database";
import { handleApiRouteError } from "@/lib/api-errors";
import { ensureUserRecord } from "@/lib/app-user";
import {
  getFeedMembershipFolderIds,
  resolveFeedFolderIds,
} from "@/lib/folder-memberships";

interface FolderRow {
  id: string;
  name: string;
}

interface FeedRow {
  id: string;
  url: string;
  title: string | null;
  customTitle: string | null;
  description: string | null;
  lastFetchedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  folderMemberships?: Array<{ folderId: string }>;
}

interface ExportUserRecord {
  id: string;
  clerkId: string;
  email: string;
  createdAt: Date;
  folders?: FolderRow[];
  feeds?: FeedRow[];
}

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

function toResolvedFeedFolderIds(feed: FeedRow): string[] {
  return resolveFeedFolderIds(getFeedMembershipFolderIds(feed));
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

async function queryExportUser(userId: string): Promise<ExportUserRecord | null> {
  return (await db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: {
      id: true,
      clerkId: true,
      email: true,
      createdAt: true,
    },
    with: {
      folders: {
        columns: {
          id: true,
          name: true,
        },
      },
      feeds: {
        columns: {
          id: true,
          url: true,
          title: true,
          customTitle: true,
          description: true,
          lastFetchedAt: true,
          createdAt: true,
          updatedAt: true,
        },
        with: {
          folderMemberships: {
            columns: {
              folderId: true,
            },
          },
        },
      },
    },
  })) as ExportUserRecord | null;
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

    const format = request.nextUrl.searchParams.get("format") || "opml";
    const jsonVersion = request.nextUrl.searchParams.get("version") || "2";

    if (format === "json" && jsonVersion !== "2") {
      return NextResponse.json(
        { error: "Unsupported JSON export version" },
        { status: 400 }
      );
    }

    const user = await queryExportUser(ensuredUser.id);

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const folderRows = user.folders ?? [];
    const feedRows = user.feeds ?? [];
    const folderNameById = new Map(folderRows.map((folder) => [folder.id, folder.name]));
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
          folderIds: toResolvedFeedFolderIds(feed),
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
      const portableExport = {
        version: 2 as const,
        exportedAt: nowIso,
        sourceApp: "FeedMyOwl" as const,
        feeds: feedRows
          .map((feed) => {
            const folderNames = toResolvedFeedFolderIds(feed)
              .map((folderId) => folderNameById.get(folderId))
              .filter((name): name is string => Boolean(name))
              .sort((a, b) => a.localeCompare(b));

            return {
              url: feed.url,
              customTitle: feed.customTitle,
              folders: folderNames,
            };
          })
          .sort((a, b) => {
            const aLabel = a.customTitle || a.url;
            const bLabel = b.customTitle || b.url;
            return aLabel.localeCompare(bLabel);
          }),
      };

      return new NextResponse(JSON.stringify(portableExport, null, 2), {
        status: 200,
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          "Content-Disposition": `attachment; filename="feedmyowl-data-v2-${filenameDate}.json"`,
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
