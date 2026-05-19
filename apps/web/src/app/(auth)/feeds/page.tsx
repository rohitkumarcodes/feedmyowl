import { db } from "@/lib/server/database";
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
import { purgeOldFeedItems } from "@/lib/server/retention";
import { listArticlePage } from "@/lib/server/article-service";

export const dynamic = "force-dynamic";

function toIsoString(value: Date | null): string | null {
  return value ? value.toISOString() : null;
}

export default async function FeedsPage() {
  await purgeOldFeedItems();

  const allScope: ArticleScope = { type: "all" };

  const folderRows = await db.query.folders.findMany();
  const feedRows = await db.query.feeds.findMany({
    with: {
      folderMemberships: {
        columns: { folderId: true },
      },
    },
  });

  const initialArticlePage = await listArticlePage({
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
            savedAt: toIsoString(item.savedAt),
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
    />
  );
}
