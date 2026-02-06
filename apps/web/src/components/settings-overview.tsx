"use client";

import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import styles from "./settings-overview.module.css";

interface SettingsOverviewProps {
  email: string;
  clerkId: string;
  memberSince: string;
  subscriptionTier: string;
  hasStripeCustomer: boolean;
  hasStripeSubscription: boolean;
  feedCount: number;
  lastFetchedAt: string | null;
  freeFeedLimit: number;
  billingConfigured: boolean;
}

interface BillingResponse {
  url?: string;
  error?: string;
}

function formatDateTime(iso: string | null): string {
  if (!iso) {
    return "Never";
  }
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.valueOf())) {
    return "Unknown";
  }
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(parsed);
}

async function openBillingRoute(
  path: string,
  setPending: (value: boolean) => void,
  setError: (value: string | null) => void
) {
  setPending(true);
  setError(null);

  const response = await fetch(path, { method: "POST" });
  let payload: BillingResponse = {};
  try {
    payload = (await response.json()) as BillingResponse;
  } catch {
    payload = {};
  }

  if (!response.ok || !payload.url) {
    setPending(false);
    setError(payload.error || "Could not start billing flow.");
    return;
  }

  window.location.assign(payload.url);
}

export function SettingsOverview({
  email,
  clerkId,
  memberSince,
  subscriptionTier,
  hasStripeCustomer,
  hasStripeSubscription,
  feedCount,
  lastFetchedAt,
  freeFeedLimit,
  billingConfigured,
}: SettingsOverviewProps) {
  const searchParams = useSearchParams();
  const [billingError, setBillingError] = useState<string | null>(null);
  const [isOpeningCheckout, setIsOpeningCheckout] = useState(false);
  const [isOpeningPortal, setIsOpeningPortal] = useState(false);

  const isFreePlan = subscriptionTier === "free";
  const usagePercent = useMemo(() => {
    if (!isFreePlan) {
      return 0;
    }
    return Math.min(100, Math.round((feedCount / freeFeedLimit) * 100));
  }, [feedCount, freeFeedLimit, isFreePlan]);

  return (
    <div className={styles.root}>
      <section className={styles.hero}>
        <p className={styles.eyebrow}>Account Center</p>
        <h1 className={styles.title}>Settings with real controls, not placeholders.</h1>
        <p className={styles.description}>
          Review your plan, manage billing in Stripe, and export your subscriptions
          any time.
        </p>
      </section>

      {searchParams.get("success") === "true" ? (
        <p className={styles.successBanner}>
          Subscription updated successfully. Your account will reflect Stripe changes
          as soon as webhooks are received.
        </p>
      ) : null}
      {searchParams.get("canceled") === "true" ? (
        <p className={styles.infoBanner}>Checkout was canceled. No changes were made.</p>
      ) : null}
      {billingError ? <p className={styles.errorBanner}>{billingError}</p> : null}

      <section className={styles.grid}>
        <article className={styles.card}>
          <h2>Account</h2>
          <dl className={styles.metaList}>
            <div>
              <dt>Email</dt>
              <dd>{email}</dd>
            </div>
            <div>
              <dt>Member since</dt>
              <dd>{formatDateTime(memberSince)}</dd>
            </div>
            <div>
              <dt>Clerk ID</dt>
              <dd className={styles.mono}>{clerkId}</dd>
            </div>
          </dl>
        </article>

        <article className={styles.card}>
          <h2>Subscription</h2>
          <p className={styles.planRow}>
            <span
              className={`${styles.planBadge} ${
                isFreePlan ? styles.planFree : styles.planPaid
              }`}
            >
              {subscriptionTier.toUpperCase()}
            </span>
            {hasStripeCustomer ? "Stripe customer linked" : "Stripe customer not created yet"}
          </p>

          {isFreePlan ? (
            <div className={styles.usageWrap}>
              <p>
                Feed usage: {feedCount}/{freeFeedLimit}
              </p>
              <div className={styles.usageBar}>
                <span style={{ width: `${usagePercent}%` }} />
              </div>
            </div>
          ) : (
            <p className={styles.planDetail}>
              Paid plan active
              {hasStripeSubscription ? " with recurring subscription." : "."}
            </p>
          )}

          <div className={styles.buttonRow}>
            {isFreePlan ? (
              <button
                type="button"
                className={styles.primaryButton}
                onClick={() =>
                  openBillingRoute(
                    "/api/billing/checkout",
                    setIsOpeningCheckout,
                    setBillingError
                  )
                }
                disabled={!billingConfigured || isOpeningCheckout}
              >
                {isOpeningCheckout ? "Opening checkout..." : "Upgrade to paid"}
              </button>
            ) : (
              <button
                type="button"
                className={styles.primaryButton}
                onClick={() =>
                  openBillingRoute(
                    "/api/billing/portal",
                    setIsOpeningPortal,
                    setBillingError
                  )
                }
                disabled={!billingConfigured || isOpeningPortal}
              >
                {isOpeningPortal ? "Opening portal..." : "Manage billing"}
              </button>
            )}
          </div>
          {!billingConfigured ? (
            <p className={styles.hint}>
              Billing actions are disabled until Stripe environment variables are set.
            </p>
          ) : null}
        </article>
      </section>

      <section className={styles.grid}>
        <article className={styles.card}>
          <h2>Reading data</h2>
          <p className={styles.paragraph}>
            Last feed refresh: {formatDateTime(lastFetchedAt)}
          </p>
          <p className={styles.paragraph}>
            Export your subscriptions as OPML and import them in any compatible RSS
            reader.
          </p>
          <a href="/api/feeds/export" className={styles.secondaryLink}>
            Download OPML export
          </a>
        </article>

        <article className={styles.card}>
          <h2>Danger zone</h2>
          <p className={styles.paragraph}>
            Account deletion flow is intentionally disabled for now to avoid accidental
            data loss while we finish end-to-end deletion across Clerk, Stripe, and the
            database.
          </p>
          <button type="button" className={styles.dangerButton} disabled>
            Delete account (coming soon)
          </button>
        </article>
      </section>
    </div>
  );
}
