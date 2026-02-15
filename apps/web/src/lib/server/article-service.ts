import "server-only";

import {
  and,
  db,
  eq,
  feedFolderMemberships,
  feedItems,
  feeds,
  folders,
  inArray,
  isNull,
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
  createdAt: Date;
}

type ResolveScopeFeedIdsResult =
  | { status: "ok"; feedIds: string[] }
  | { status: "scope_not_found" };

export type ListArticlePageForUserResult =
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

async function loadUserFeedAssignments(userId: string): Promise<FeedAssignment[]> {
  const userFeeds = await db.query.feeds.findMany({
    where: eq(feeds.userId, userId),
    columns: {
      id: true,
    },
  });

  const memberships = await db.query.feedFolderMemberships.findMany({
    where: eq(feedFolderMemberships.userId, userId),
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

  return userFeeds.map((feed) => ({
    id: feed.id,
    assignedFolderIds: resolveFeedFolderIds(
      membershipFolderIdsByFeedId.get(feed.id) ?? [],
    ),
  }));
}

async function resolveScopeFeedIdsForUser(
  userId: string,
  scope: ArticleScope,
): Promise<ResolveScopeFeedIdsResult> {
  if (scope.type === "all" || scope.type === "unread") {
    // "unread" uses all feeds — the readAt IS NULL filter is applied later in the query.
    const userFeeds = await db.query.feeds.findMany({
      where: eq(feeds.userId, userId),
      columns: {
        id: true,
      },
    });

    return {
      status: "ok",
      feedIds: userFeeds.map((feed) => feed.id),
    };
  }

  if (scope.type === "feed") {
    const userFeed = await db.query.feeds.findFirst({
      where: and(eq(feeds.userId, userId), eq(feeds.id, scope.id)),
      columns: {
        id: true,
      },
    });

    if (!userFeed) {
      return { status: "scope_not_found" };
    }

    return {
      status: "ok",
      feedIds: [userFeed.id],
    };
  }

  if (scope.type === "folder") {
    const folder = await db.query.folders.findFirst({
      where: and(eq(folders.userId, userId), eq(folders.id, scope.id)),
      columns: {
        id: true,
      },
    });

    if (!folder) {
      return { status: "scope_not_found" };
    }

    const userFeedAssignments = await loadUserFeedAssignments(userId);
    return {
      status: "ok",
      feedIds: userFeedAssignments
        .filter((feedAssignment) => feedAssignment.assignedFolderIds.includes(scope.id))
        .map((feedAssignment) => feedAssignment.id),
    };
  }

  const userFeedAssignments = await loadUserFeedAssignments(userId);
  return {
    status: "ok",
    feedIds: userFeedAssignments
      .filter((feedAssignment) => feedAssignment.assignedFolderIds.length === 0)
      .map((feedAssignment) => feedAssignment.id),
  };
}

export async function listArticlePageForUser(params: {
  userId: string;
  scope: ArticleScope;
  cursor: EncodedArticleCursor | null;
  limit: number;
}): Promise<ListArticlePageForUserResult> {
  const resolved = await resolveScopeFeedIdsForUser(params.userId, params.scope);
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

  const sortKeyExpression = sql`coalesce(${feedItems.publishedAt}, ${feedItems.createdAt})`;

  const cursorTimestamp = params.cursor ? toDate(params.cursor.sortKeyIso) : null;

  // Build the base filter: feed scope + optional unread-only restriction.
  const feedFilter = inArray(feedItems.feedId, resolved.feedIds);
  const baseScopeFilter =
    params.scope.type === "unread"
      ? and(feedFilter, isNull(feedItems.readAt))
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
      createdAt: feedItems.createdAt,
      sortKey: sql<Date>`coalesce(${feedItems.publishedAt}, ${feedItems.createdAt})`,
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
    createdAt: toDate(row.createdAt),
  }));

  const nextCursor = hasMore
    ? (() => {
        const lastRow = pagedRows[pagedRows.length - 1];
        const sortKey = toDate(lastRow.sortKey);
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
