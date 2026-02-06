import { requireAuth } from "@/lib/auth";
import { db, eq, users } from "@/lib/database";
import { ensureUserRecord } from "@/lib/app-user";
import {
  FeedItemViewModel,
  FeedsWorkspace,
  FeedViewModel,
} from "@/components/feeds-workspace";

const FREE_FEED_LIMIT = 10;

function toIsoString(value: Date | null): string | null {
  return value ? value.toISOString() : null;
}

export default async function FeedsPage() {
  const { clerkId } = await requireAuth();
  const ensuredUser = await ensureUserRecord(clerkId);

  if (!ensuredUser) {
    return (
      <FeedsWorkspace
        initialFeeds={[]}
        subscriptionTier="free"
        freeFeedLimit={FREE_FEED_LIMIT}
      />
    );
  }

  const user = await db.query.users.findFirst({
    where: eq(users.id, ensuredUser.id),
    with: {
      feeds: {
        with: {
          items: true,
        },
      },
    },
  });

  const feeds: FeedViewModel[] =
    user?.feeds
      ?.map((feed) => {
        const items = [...feed.items]
          .sort((a, b) => {
            const aDate =
              a.publishedAt?.valueOf() ?? a.createdAt.valueOf();
            const bDate =
              b.publishedAt?.valueOf() ?? b.createdAt.valueOf();
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
              createdAt: item.createdAt.toISOString(),
            })
          );

        return {
          id: feed.id,
          title: feed.title,
          description: feed.description,
          url: feed.url,
          lastFetchedAt: toIsoString(feed.lastFetchedAt),
          createdAt: feed.createdAt.toISOString(),
          items,
        };
      })
      .sort((a, b) => {
        const aDate = Date.parse(a.lastFetchedAt || a.createdAt) || 0;
        const bDate = Date.parse(b.lastFetchedAt || b.createdAt) || 0;
        return bDate - aDate;
      }) ?? [];

  return (
    <FeedsWorkspace
      initialFeeds={feeds}
      subscriptionTier={user?.subscriptionTier ?? ensuredUser.subscriptionTier}
      freeFeedLimit={FREE_FEED_LIMIT}
    />
  );
}
