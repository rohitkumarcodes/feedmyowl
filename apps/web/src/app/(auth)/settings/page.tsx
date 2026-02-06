import { requireAuth } from "@/lib/auth";
import { db, eq, users } from "@/lib/database";
import { ensureUserRecord } from "@/lib/app-user";
import { SettingsOverview } from "@/components/settings-overview";

const FREE_FEED_LIMIT = 10;

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
        subscriptionTier="free"
        hasStripeCustomer={false}
        hasStripeSubscription={false}
        feedCount={0}
        lastFetchedAt={null}
        freeFeedLimit={FREE_FEED_LIMIT}
        billingConfigured={false}
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

  const billingConfigured = Boolean(
    process.env.STRIPE_SECRET_KEY &&
      process.env.NEXT_PUBLIC_APP_URL &&
      process.env.STRIPE_PRICE_ID
  );

  const safeUser = user ?? ensuredUser;

  return (
    <SettingsOverview
      email={safeUser.email}
      clerkId={safeUser.clerkId}
      memberSince={safeUser.createdAt.toISOString()}
      subscriptionTier={safeUser.subscriptionTier}
      hasStripeCustomer={Boolean(safeUser.stripeCustomerId)}
      hasStripeSubscription={Boolean(safeUser.stripeSubscriptionId)}
      feedCount={feedCount}
      lastFetchedAt={toIsoString(lastFetchedAt)}
      freeFeedLimit={FREE_FEED_LIMIT}
      billingConfigured={billingConfigured}
    />
  );
}
