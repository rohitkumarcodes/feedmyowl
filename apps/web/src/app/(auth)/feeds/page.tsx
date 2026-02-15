/**
 * Server-rendered feeds page that loads feeds and article items for
 * the authenticated user and passes them to the client workspace shell.
 */
import { db, eq, users } from "@/lib/server/database";
import { getAuthenticatedAppUser } from "@/lib/server/app-user";
import { FeedsWorkspace } from "@/features/feeds/components/FeedsWorkspace";
import { createInitialPaginationByScopeKey } from "@/features/feeds/state/article-pagination-state";
import type {
  FeedViewModel,
  FeedItemViewModel,
  FolderViewModel,
} from "@/features/feeds/types/view-models";
import {
  DEFAULT_ARTICLE_PAGE_LIMIT,
  scopeToKey,
  type ArticleScope,
} from "@/lib/shared/article-pagination";
import {
  getFeedMembershipFolderIds,
  resolveFeedFolderIds,
} from "@/lib/shared/folder-memberships";
import {
  isUserRetentionPurgeNeeded,
  purgeOldFeedItemsForUser,
} from "@/lib/server/retention";
import { listArticlePageForUser } from "@/lib/server/article-service";
import { coerceReadingMode, DEFAULT_READING_MODE } from "@/lib/shared/reading-mode";

/**
 * This page reads per-user data at request time — never statically prerender.
 */
export const dynamic = "force-dynamic";

function toIsoString(value: Date | null): string | null {
  return value ? value.toISOString() : null;
}

function createEmptyInitialPaginationByScopeKey() {
  return createInitialPaginationByScopeKey({
    scopeKey: scopeToKey({ type: "all" }),
    nextCursor: null,
    hasMore: false,
  });
}

/**
 * Loads authenticated feed data and renders the interactive workspace.
 */
export default async function FeedsPage() {
  const { appUser: ensuredUser } = await getAuthenticatedAppUser();

  if (!ensuredUser) {
    return (
      <FeedsWorkspace
        initialFeeds={[]}
        initialFolders={[]}
        initialPaginationByScopeKey={createEmptyInitialPaginationByScopeKey()}
        initialReadingMode={DEFAULT_READING_MODE}
      />
    );
  }

  // Enforce 50-items-per-feed cap only when at least one feed is over the limit.
  if (await isUserRetentionPurgeNeeded(ensuredUser.id)) {
    await purgeOldFeedItemsForUser(ensuredUser.id);
  }

  const user = (await db.query.users.findFirst({
    where: eq(users.id, ensuredUser.id),
    columns: {
      id: true,
      clerkId: true,
      email: true,
      readingMode: true,
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
          folderMemberships: {
            columns: {
              folderId: true,
            },
          },
        },
      },
    },
  })) as Record<string, unknown> | null;

  if (!user) {
    return (
      <FeedsWorkspace
        initialFeeds={[]}
        initialFolders={[]}
        initialPaginationByScopeKey={createEmptyInitialPaginationByScopeKey()}
        initialReadingMode={DEFAULT_READING_MODE}
      />
    );
  }

  const userReadingMode = coerceReadingMode(
    (user as Record<string, unknown>).readingMode,
  );

  const allScope: ArticleScope = { type: "all" };
  const initialArticlePage = await listArticlePageForUser({
    userId: ensuredUser.id,
    scope: allScope,
    cursor: null,
    limit: DEFAULT_ARTICLE_PAGE_LIMIT,
  });

  const initialPageItems =
    initialArticlePage.status === "ok" ? initialArticlePage.items : [];

  const initialItemsByFeedId = new Map<string, typeof initialPageItems>();
  for (const item of initialPageItems) {
    const existing = initialItemsByFeedId.get(item.feedId) ?? [];
    existing.push(item);
    initialItemsByFeedId.set(item.feedId, existing);
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
          title: string | null;
          customTitle: string | null;
          description: string | null;
          url: string;
          lastFetchedAt: Date | null;
          lastFetchStatus: string | null;
          lastFetchErrorCode: string | null;
          lastFetchErrorMessage: string | null;
          lastFetchErrorAt: Date | null;
          createdAt: Date;
          folderMemberships?: Array<{ folderId: string }>;
        }>
      | undefined) ?? [];

  const folders: FolderViewModel[] = folderRows
    .map((folder) => ({
      id: folder.id,
      name: folder.name,
      createdAt: folder.createdAt.toISOString(),
      updatedAt: folder.updatedAt.toISOString(),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  const feeds: FeedViewModel[] = feedRows
    .map((feed) => {
      const scopedInitialItems = [...(initialItemsByFeedId.get(feed.id) ?? [])]
        .sort((a, b) => {
          const aDate = a.publishedAt?.valueOf() ?? a.createdAt.valueOf();
          const bDate = b.publishedAt?.valueOf() ?? b.createdAt.valueOf();
          return bDate - aDate;
        })
        .map(
          (item): FeedItemViewModel => ({
            id: item.id,
            title: item.title,
            link: item.link,
            content: item.content,
            author: item.author,
            publishedAt: toIsoString(item.publishedAt),
            readAt: toIsoString(item.readAt),
            createdAt: item.createdAt.toISOString(),
          }),
        );

      return {
        id: feed.id,
        title: feed.title,
        customTitle: feed.customTitle,
        description: feed.description,
        url: feed.url,
        folderIds: resolveFeedFolderIds(getFeedMembershipFolderIds(feed)),
        lastFetchedAt: toIsoString(feed.lastFetchedAt),
        lastFetchStatus: feed.lastFetchStatus,
        lastFetchErrorCode: feed.lastFetchErrorCode,
        lastFetchErrorMessage: feed.lastFetchErrorMessage,
        lastFetchErrorAt: toIsoString(feed.lastFetchErrorAt),
        createdAt: feed.createdAt.toISOString(),
        items: scopedInitialItems,
      };
    })
    .sort((a, b) => {
      const aDate = Date.parse(a.lastFetchedAt || a.createdAt) || 0;
      const bDate = Date.parse(b.lastFetchedAt || b.createdAt) || 0;
      return bDate - aDate;
    });

  const initialPaginationByScopeKey = createInitialPaginationByScopeKey({
    scopeKey: scopeToKey(allScope),
    nextCursor: initialArticlePage.status === "ok" ? initialArticlePage.nextCursor : null,
    hasMore: initialArticlePage.status === "ok" ? initialArticlePage.hasMore : false,
  });

  return (
    <FeedsWorkspace
      initialFeeds={feeds}
      initialFolders={folders}
      initialPaginationByScopeKey={initialPaginationByScopeKey}
      initialReadingMode={userReadingMode}
    />
  );
}
