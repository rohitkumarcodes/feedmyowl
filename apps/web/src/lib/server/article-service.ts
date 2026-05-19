import "server-only";

import {
  and,
  db,
  eq,
  feedItems,
  feeds,
  folders,
  inArray,
  sql,
} from "@/lib/server/database";
import {
  type ArticleScope,
  encodeArticleCursor,
  type EncodedArticleCursor,
} from "@/lib/shared/article-pagination";
import { resolveFeedFolderIds } from "@/lib/shared/folder-memberships";

interface FeedAssignment {
  id: string;
  assignedFolderIds: string[];
}

export interface ArticlePageItemRecord {
  id: string;
  feedId: string;
  title: string | null;
  link: string | null;
  content: string | null;
  author: string | null;
  publishedAt: Date | null;
  readAt: Date | null;
  savedAt: Date | null;
  createdAt: Date;
}

type ResolveScopeFeedIdsResult =
  | { status: "ok"; feedIds: string[] }
  | { status: "scope_not_found" };

export type ListArticlePageResult =
  | {
      status: "ok";
      items: ArticlePageItemRecord[];
      nextCursor: string | null;
      hasMore: boolean;
      limit: number;
      scope: ArticleScope;
    }
  | { status: "scope_not_found" };

function toDateOrNull(value: Date | string | null): Date | null {
  if (!value) {
    return null;
  }

  if (value instanceof Date) {
    return Number.isNaN(value.valueOf()) ? null : value;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.valueOf()) ? null : parsed;
}

function toDate(value: Date | string): Date {
  if (value instanceof Date) {
    return value;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.valueOf())) {
    return new Date();
  }

  return parsed;
}

async function loadFeedAssignments(): Promise<FeedAssignment[]> {
  const allFeeds = await db.query.feeds.findMany({
    columns: {
      id: true,
    },
  });

  const memberships = await db.query.feedFolderMemberships.findMany({
    columns: {
      feedId: true,
      folderId: true,
    },
  });

  const membershipFolderIdsByFeedId = new Map<string, string[]>();
  for (const membership of memberships) {
    const existing = membershipFolderIdsByFeedId.get(membership.feedId) ?? [];
    existing.push(membership.folderId);
    membershipFolderIdsByFeedId.set(membership.feedId, existing);
  }

  return allFeeds.map((feed) => ({
    id: feed.id,
    assignedFolderIds: resolveFeedFolderIds(
      membershipFolderIdsByFeedId.get(feed.id) ?? [],
    ),
  }));
}

async function resolveScopeFeedIds(
  scope: ArticleScope,
): Promise<ResolveScopeFeedIdsResult> {
  if (scope.type === "all" || scope.type === "saved") {
    const allFeeds = await db.query.feeds.findMany({
      columns: {
        id: true,
      },
    });

    return {
      status: "ok",
      feedIds: allFeeds.map((feed) => feed.id),
    };
  }

  if (scope.type === "feed") {
    const feed = await db.query.feeds.findFirst({
      where: eq(feeds.id, scope.id),
      columns: {
        id: true,
      },
    });

    if (!feed) {
      return { status: "scope_not_found" };
    }

    return {
      status: "ok",
      feedIds: [feed.id],
    };
  }

  if (scope.type === "folder") {
    const folder = await db.query.folders.findFirst({
      where: eq(folders.id, scope.id),
      columns: {
        id: true,
      },
    });

    if (!folder) {
      return { status: "scope_not_found" };
    }

    const feedAssignments = await loadFeedAssignments();
    return {
      status: "ok",
      feedIds: feedAssignments
        .filter((feedAssignment) => feedAssignment.assignedFolderIds.includes(scope.id))
        .map((feedAssignment) => feedAssignment.id),
    };
  }

  const feedAssignments = await loadFeedAssignments();
  return {
    status: "ok",
    feedIds: feedAssignments
      .filter((feedAssignment) => feedAssignment.assignedFolderIds.length === 0)
      .map((feedAssignment) => feedAssignment.id),
  };
}

export async function listArticlePage(params: {
  scope: ArticleScope;
  cursor: EncodedArticleCursor | null;
  limit: number;
}): Promise<ListArticlePageResult> {
  const resolved = await resolveScopeFeedIds(params.scope);
  if (resolved.status === "scope_not_found") {
    return { status: "scope_not_found" };
  }

  if (resolved.feedIds.length === 0) {
    return {
      status: "ok",
      items: [],
      nextCursor: null,
      hasMore: false,
      limit: params.limit,
      scope: params.scope,
    };
  }

  const sortKeyExpression =
    params.scope.type === "saved"
      ? sql`${feedItems.savedAt}`
      : sql`coalesce(${feedItems.publishedAt}, ${feedItems.createdAt})`;

  const cursorTimestamp = params.cursor ? toDate(params.cursor.sortKeyIso) : null;

  // Build the base filter: feed scope + optional saved restriction.
  const feedFilter = inArray(feedItems.feedId, resolved.feedIds);
  const baseScopeFilter =
    params.scope.type === "saved"
      ? and(feedFilter, sql`${feedItems.savedAt} is not null`)
      : feedFilter;

  const whereClause = params.cursor
    ? and(
        baseScopeFilter,
        sql`(${sortKeyExpression} < ${cursorTimestamp} OR (${sortKeyExpression} = ${cursorTimestamp} AND ${feedItems.id} < ${params.cursor.itemId}))`,
      )
    : baseScopeFilter;

  const rows = await db
    .select({
      id: feedItems.id,
      feedId: feedItems.feedId,
      title: feedItems.title,
      link: feedItems.link,
      content: feedItems.content,
      author: feedItems.author,
      publishedAt: feedItems.publishedAt,
      readAt: feedItems.readAt,
      savedAt: feedItems.savedAt,
      createdAt: feedItems.createdAt,
      sortKey:
        params.scope.type === "saved"
          ? feedItems.savedAt
          : sql<Date>`coalesce(${feedItems.publishedAt}, ${feedItems.createdAt})`,
    })
    .from(feedItems)
    .where(whereClause)
    .orderBy(sql`${sortKeyExpression} DESC`, sql`${feedItems.id} DESC`)
    .limit(params.limit + 1);

  const hasMore = rows.length > params.limit;
  const pagedRows = hasMore ? rows.slice(0, params.limit) : rows;

  const items: ArticlePageItemRecord[] = pagedRows.map((row) => ({
    id: row.id,
    feedId: row.feedId,
    title: row.title,
    link: row.link,
    content: row.content,
    author: row.author,
    publishedAt: toDateOrNull(row.publishedAt),
    readAt: toDateOrNull(row.readAt),
    savedAt: toDateOrNull(row.savedAt),
    createdAt: toDate(row.createdAt),
  }));

  const nextCursor = hasMore
    ? (() => {
        const lastRow = pagedRows[pagedRows.length - 1];
        const sortKey = toDate(lastRow.sortKey ?? lastRow.createdAt);
        return encodeArticleCursor({
          v: 1,
          sortKeyIso: sortKey.toISOString(),
          itemId: lastRow.id,
        });
      })()
    : null;

  return {
    status: "ok",
    items,
    nextCursor,
    hasMore,
    limit: params.limit,
    scope: params.scope,
  };
}
