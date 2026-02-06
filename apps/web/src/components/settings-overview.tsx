"use client";

import Link from "next/link";
import styles from "./settings-overview.module.css";

interface SettingsOverviewProps {
  email: string;
  clerkId: string;
  memberSince: string;
  feedCount: number;
  lastFetchedAt: string | null;
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

/**
 * Renders the authenticated account/settings view with MVP-safe controls.
 */
export function SettingsOverview({
  email,
  clerkId,
  memberSince,
  feedCount,
  lastFetchedAt,
}: SettingsOverviewProps) {
  return (
    <div className={styles.root}>
      <header className={styles.header}>
        <h1>Settings</h1>
        <p>Account details and exports for your reading workspace.</p>
        <Link href="/feeds" className={styles.linkButton}>
          Return to feeds
        </Link>
      </header>

      <div className={styles.grid}>
        <section className={styles.panel}>
          <h2>Account</h2>
          <dl>
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
        </section>

        <section className={styles.panel}>
          <h2>Feed activity</h2>
          <dl>
            <div>
              <dt>Connected feeds</dt>
              <dd>{feedCount}</dd>
            </div>
            <div>
              <dt>Last feed refresh</dt>
              <dd>{formatDateTime(lastFetchedAt)}</dd>
            </div>
          </dl>
        </section>
      </div>

      <div className={styles.grid}>
        <section className={styles.panel}>
          <h2>Data export</h2>
          <p>Download your feed subscriptions as OPML.</p>
          <Link href="/api/feeds/export" className={styles.linkButton} prefetch={false}>
            Download OPML export
          </Link>
        </section>

        <section className={styles.panel}>
          <h2>Billing</h2>
          <p>Billing controls are intentionally hidden in the current MVP phase.</p>
          <p className={styles.muted}>Billing and feed caps return in phase 2.</p>
        </section>
      </div>
    </div>
  );
}
