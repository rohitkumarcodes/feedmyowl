/**
 * Server-rendered feeds page that loads feeds and article items for
 * the authenticated user and passes them to the client workspace shell.
 */
import { requireAuth } from "@/lib/auth";
import { db, eq, users } from "@/lib/database";
import { ensureUserRecord } from "@/lib/app-user";
import { FeedsWorkspace } from "@/components/feeds-workspace";
import type { FeedViewModel, FeedItemViewModel } from "@/components/feeds-types";
import { purgeOldFeedItemsForUser } from "@/lib/retention";

/**
 * This page reads per-user data at request time — never statically prerender.
 */
export const dynamic = "force-dynamic";

function toIsoString(value: Date | null): string | null {
  return value ? value.toISOString() : null;
}

/**
 * Loads authenticated feed data and renders the interactive workspace.
 */
export default async function FeedsPage() {
  const { clerkId } = await requireAuth();
  const ensuredUser = await ensureUserRecord(clerkId);

  if (!ensuredUser) {
    return <FeedsWorkspace initialFeeds={[]} />;
  }

  // Enforce 90-day retention during normal feed workspace loads.
  await purgeOldFeedItemsForUser(ensuredUser.id);

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
            })
          );

        return {
          id: feed.id,
          title: feed.title,
          description: feed.description,
          url: feed.url,
          lastFetchedAt: toIsoString(feed.lastFetchedAt),
          lastFetchStatus: feed.lastFetchStatus,
          lastFetchErrorCode: feed.lastFetchErrorCode,
          lastFetchErrorMessage: feed.lastFetchErrorMessage,
          lastFetchErrorAt: toIsoString(feed.lastFetchErrorAt),
          createdAt: feed.createdAt.toISOString(),
          items,
        };
      })
      .sort((a, b) => {
        const aDate = Date.parse(a.lastFetchedAt || a.createdAt) || 0;
        const bDate = Date.parse(b.lastFetchedAt || b.createdAt) || 0;
        return bDate - aDate;
      }) ?? [];

  return <FeedsWorkspace initialFeeds={feeds} />;
}
