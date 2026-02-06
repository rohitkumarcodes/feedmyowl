import { requireAuth } from "@/lib/auth";
import { db, eq, users } from "@/lib/database";
import { ensureUserRecord } from "@/lib/app-user";
import { SettingsOverview } from "@/components/settings-overview";

function toIsoString(value: Date | null): string | null {
  return value ? value.toISOString() : null;
}

export default async function SettingsPage() {
  const { clerkId } = await requireAuth();
  const ensuredUser = await ensureUserRecord(clerkId);

  if (!ensuredUser) {
    return (
      <SettingsOverview
        email="Unknown"
        clerkId={clerkId}
        memberSince={new Date().toISOString()}
        feedCount={0}
        lastFetchedAt={null}
      />
    );
  }

  const user = await db.query.users.findFirst({
    where: eq(users.id, ensuredUser.id),
    with: {
      feeds: true,
    },
  });

  const feedCount = user?.feeds.length ?? 0;
  const lastFetchedAt =
    user?.feeds.reduce<Date | null>((latest, feed) => {
      if (!feed.lastFetchedAt) {
        return latest;
      }
      if (!latest || feed.lastFetchedAt.valueOf() > latest.valueOf()) {
        return feed.lastFetchedAt;
      }
      return latest;
    }, null) ?? null;

  const safeUser = user ?? ensuredUser;

  // Billing is intentionally hidden in MVP and will return in phase 2.
  return (
    <SettingsOverview
      email={safeUser.email}
      clerkId={safeUser.clerkId}
      memberSince={safeUser.createdAt.toISOString()}
      feedCount={feedCount}
      lastFetchedAt={toIsoString(lastFetchedAt)}
    />
  );
}
