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
import { ensureUserRecord } from "@/lib/app-user";

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

/**
 * Build OPML for feeds grouped by folder assignment.
 */
function buildFolderAwareOpml(params: {
  nowIso: string;
  folders: Array<{ id: string; name: string }>;
  feeds: Array<{ url: string; title: string | null; folderId: string | null }>;
}): string {
  const sortedFolders = [...params.folders].sort((a, b) =>
    a.name.localeCompare(b.name)
  );

  const sortedFeeds = [...params.feeds].sort((a, b) => {
    const aLabel = a.title || a.url;
    const bLabel = b.title || b.url;
    return aLabel.localeCompare(bLabel);
  });

  const feedsByFolder = new Map<string, typeof sortedFeeds>();
  const uncategorized: typeof sortedFeeds = [];

  for (const feed of sortedFeeds) {
    if (!feed.folderId) {
      uncategorized.push(feed);
      continue;
    }

    const existing = feedsByFolder.get(feed.folderId) ?? [];
    existing.push(feed);
    feedsByFolder.set(feed.folderId, existing);
  }

  const uncategorizedOutlines = uncategorized
    .map((feed) => {
      const title = escapeXml(feed.title || feed.url);
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
          const title = escapeXml(feed.title || feed.url);
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

    const user = await db.query.users.findFirst({
      where: eq(users.id, ensuredUser.id),
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

    const format = request.nextUrl.searchParams.get("format") || "opml";
    const nowIso = new Date().toISOString();
    const filenameDate = nowIso.slice(0, 10);

    if (format === "opml") {
      const opml = buildFolderAwareOpml({
        nowIso,
        folders: user.folders.map((folder) => ({
          id: folder.id,
          name: folder.name,
        })),
        feeds: user.feeds.map((feed) => ({
          url: feed.url,
          title: feed.title,
          folderId: feed.folderId,
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
          id: user.id,
          clerkId: user.clerkId,
          email: user.email,
          createdAt: user.createdAt.toISOString(),
        },
        folders: user.folders
          .map((folder) => ({
            id: folder.id,
            name: folder.name,
            createdAt: folder.createdAt.toISOString(),
            updatedAt: folder.updatedAt.toISOString(),
          }))
          .sort((a, b) => a.name.localeCompare(b.name)),
        feeds: user.feeds
          .map((feed) => ({
            id: feed.id,
            url: feed.url,
            title: feed.title,
            description: feed.description,
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
            const aLabel = a.title || a.url;
            const bLabel = b.title || b.url;
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
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
