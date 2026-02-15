/**
 * API Route: /api/feeds/export
 *
 * Supported formats:
 *   - ?format=opml (default)
 *   - ?format=json (portable v2)
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/server/auth";
import { db, eq, users } from "@/lib/server/database";
import { handleApiRouteError } from "@/lib/server/api-errors";
import { ensureUserRecord } from "@/lib/server/app-user";
import { captureMessage } from "@/lib/server/error-tracking";
import {
  getFeedMembershipFolderIds,
  resolveFeedFolderIds,
} from "@/lib/shared/folder-memberships";
import { applyRouteRateLimit } from "@/lib/server/rate-limit";

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

/** The separator used to flatten nested folder paths into a single name. */
const FOLDER_PATH_SEPARATOR = " / ";

/**
 * Render a single feed as an OPML outline element.
 */
function buildFeedOutline(
  feed: { url: string; title: string | null; customTitle: string | null },
  indent: string,
): string {
  const title = escapeXml(feed.customTitle || feed.title || feed.url);
  const url = escapeXml(feed.url);
  return `${indent}<outline text="${title}" title="${title}" type="rss" xmlUrl="${url}" />`;
}

/**
 * A tree node representing a folder that may contain feeds and sub-folders.
 * Folder names containing " / " (the flattening separator) are split back
 * into nested nodes so the OPML export preserves hierarchy for readers that
 * support it (e.g. Feedly, Inoreader).
 */
interface FolderTreeNode {
  name: string;
  children: Map<string, FolderTreeNode>;
  feeds: Array<{ url: string; title: string | null; customTitle: string | null }>;
}

function getOrCreateChild(parent: FolderTreeNode, childName: string): FolderTreeNode {
  let child = parent.children.get(childName);
  if (!child) {
    child = { name: childName, children: new Map(), feeds: [] };
    parent.children.set(childName, child);
  }
  return child;
}

/**
 * Render a folder tree node as nested OPML outline elements.
 */
function renderFolderNode(node: FolderTreeNode, depth: number): string {
  const indent = "  ".repeat(depth + 2);
  const childIndent = "  ".repeat(depth + 3);
  const lines: string[] = [];

  // Sort children alphabetically.
  const sortedChildren = [...node.children.values()].sort((a, b) =>
    a.name.localeCompare(b.name),
  );

  // Sort feeds alphabetically by display label.
  const sortedFeeds = [...node.feeds].sort((a, b) => {
    const aLabel = a.customTitle || a.title || a.url;
    const bLabel = b.customTitle || b.title || b.url;
    return aLabel.localeCompare(bLabel);
  });

  const escapedName = escapeXml(node.name);

  // If this node has no content at all, skip it.
  if (sortedChildren.length === 0 && sortedFeeds.length === 0) {
    return "";
  }

  lines.push(`${indent}<outline text="${escapedName}" title="${escapedName}">`);

  for (const child of sortedChildren) {
    const childBlock = renderFolderNode(child, depth + 1);
    if (childBlock) {
      lines.push(childBlock);
    }
  }

  for (const feed of sortedFeeds) {
    lines.push(buildFeedOutline(feed, childIndent));
  }

  lines.push(`${indent}</outline>`);
  return lines.join("\n");
}

/**
 * Build OPML for feeds grouped by folder assignment.
 *
 * Folder names that contain " / " (from flattened nested imports) are
 * split back into a nested outline hierarchy so that readers which support
 * sub-folders see the correct structure.
 */
function buildFolderAwareOpml(params: {
  nowIso: string;
  ownerEmail?: string;
  folders: Array<{ id: string; name: string }>;
  feeds: Array<{
    url: string;
    title: string | null;
    customTitle: string | null;
    folderIds: string[];
  }>;
}): string {
  const sortedFeeds = [...params.feeds].sort((a, b) => {
    const aLabel = a.customTitle || a.title || a.url;
    const bLabel = b.customTitle || b.title || b.url;
    return aLabel.localeCompare(bLabel);
  });

  const folderNameById = new Map(params.folders.map((f) => [f.id, f.name]));

  // Build a tree of folder nodes. Each flattened name like "Tech / Web"
  // becomes nested nodes: root → Tech → Web.
  const rootChildren = new Map<string, FolderTreeNode>();
  const uncategorized: typeof sortedFeeds = [];

  function ensurePath(folderName: string): FolderTreeNode {
    const segments = folderName.split(FOLDER_PATH_SEPARATOR);
    let current: FolderTreeNode | null = null;

    for (let i = 0; i < segments.length; i++) {
      const segment = segments[i].trim();
      if (!segment) continue;

      if (i === 0 || !current) {
        let root = rootChildren.get(segment);
        if (!root) {
          root = { name: segment, children: new Map(), feeds: [] };
          rootChildren.set(segment, root);
        }
        current = root;
      } else {
        current = getOrCreateChild(current, segment);
      }
    }

    return current!;
  }

  for (const feed of sortedFeeds) {
    if (feed.folderIds.length === 0) {
      uncategorized.push(feed);
      continue;
    }

    for (const folderId of feed.folderIds) {
      const folderName = folderNameById.get(folderId);
      if (!folderName) continue;
      const leafNode = ensurePath(folderName);
      leafNode.feeds.push(feed);
    }
  }

  // Render uncategorized feeds (top-level, no folder).
  const uncategorizedOutlines = uncategorized
    .map((feed) => buildFeedOutline(feed, "    "))
    .join("\n");

  // Render folder tree nodes.
  const sortedRoots = [...rootChildren.values()].sort((a, b) =>
    a.name.localeCompare(b.name),
  );
  const folderBlocks = sortedRoots
    .map((node) => renderFolderNode(node, 0))
    .filter(Boolean)
    .join("\n");

  const bodyLines = [uncategorizedOutlines, folderBlocks]
    .filter((block) => block.trim().length > 0)
    .join("\n");

  const ownerEmailLine = params.ownerEmail
    ? `\n    <ownerEmail>${escapeXml(params.ownerEmail)}</ownerEmail>`
    : "";

  return `<?xml version="1.0" encoding="UTF-8"?>
<opml version="2.0">
  <head>
    <title>FeedMyOwl Export</title>
    <dateCreated>${params.nowIso}</dateCreated>${ownerEmailLine}
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
  const startedAtMs = Date.now();

  try {
    const { clerkId } = await requireAuth();
    const ensuredUser = await ensureUserRecord(clerkId);

    if (!ensuredUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const rateLimit = await applyRouteRateLimit({
      request,
      routeKey: "api_feeds_export_get",
      userId: ensuredUser.id,
      userLimitPerMinute: 20,
      ipLimitPerMinute: 120,
    });

    if (!rateLimit.allowed) {
      return rateLimit.response;
    }

    const format = request.nextUrl.searchParams.get("format") || "opml";
    const jsonVersion = request.nextUrl.searchParams.get("version") || "2";

    if (format === "json" && jsonVersion !== "2") {
      return NextResponse.json(
        { error: "Unsupported JSON export version" },
        { status: 400 },
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
        ownerEmail: user.email,
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

      captureMessage(
        `feeds.export.completed route=api.feeds.export.get format=opml feeds=${feedRows.length} folders=${folderRows.length} duration_ms=${Date.now() - startedAtMs}`,
      );

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
      // Include all folder names so empty folders survive a round-trip.
      const allFolderNames = folderRows
        .map((folder) => folder.name)
        .sort((a, b) => a.localeCompare(b));

      const portableExport = {
        version: 2 as const,
        exportedAt: nowIso,
        sourceApp: "FeedMyOwl" as const,
        folders: allFolderNames,
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

      captureMessage(
        `feeds.export.completed route=api.feeds.export.get format=json feeds=${feedRows.length} folders=${folderRows.length} duration_ms=${Date.now() - startedAtMs}`,
      );

      return new NextResponse(JSON.stringify(portableExport, null, 2), {
        status: 200,
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          "Content-Disposition": `attachment; filename="feedmyowl-data-v2-${filenameDate}.json"`,
          "Cache-Control": "no-store",
        },
      });
    }

    return NextResponse.json({ error: "Unsupported export format" }, { status: 400 });
  } catch (error) {
    return handleApiRouteError(error, "api.feeds.export.get");
  }
}
