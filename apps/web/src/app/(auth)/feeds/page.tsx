/**
 * Server-rendered feeds page that loads folders, feeds, and article items for
 * the authenticated user and passes them to the client workspace shell.
 */
import { requireAuth } from "@/lib/auth";
import { db, eq, users } from "@/lib/database";
import { ensureUserRecord } from "@/lib/app-user";
import { FeedsWorkspace } from "@/components/feeds-workspace";
import type { FeedViewModel, FeedItemViewModel, FolderViewModel } from "@/components/feeds-types";

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
    return <FeedsWorkspace initialFeeds={[]} initialFolders={[]} />;
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

  const folders: FolderViewModel[] =
    user?.folders
      ?.map((folder) => ({
        id: folder.id,
        name: folder.name,
        createdAt: folder.createdAt.toISOString(),
        updatedAt: folder.updatedAt.toISOString(),
      }))
      .sort((a, b) => a.name.localeCompare(b.name)) ?? [];

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
          folderId: feed.folderId,
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

  return <FeedsWorkspace initialFeeds={feeds} initialFolders={folders} />;
}
