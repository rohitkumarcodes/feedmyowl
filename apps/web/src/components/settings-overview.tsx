"use client";

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

export function SettingsOverview({
  email,
  clerkId,
  memberSince,
  feedCount,
  lastFetchedAt,
}: SettingsOverviewProps) {
  return (
    <div className={styles.root}>
      <section className={styles.hero}>
        <p className={styles.eyebrow}>Account Center</p>
        <h1 className={styles.title}>MVP settings focused on reading essentials.</h1>
        <p className={styles.description}>
          Review account details, monitor feed activity, and export your feed list.
          Billing is intentionally hidden in this phase and will return in phase 2.
        </p>
      </section>

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
          <h2>Feed activity</h2>
          <dl className={styles.metaList}>
            <div>
              <dt>Connected feeds</dt>
              <dd>{feedCount}</dd>
            </div>
            <div>
              <dt>Last feed refresh</dt>
              <dd>{formatDateTime(lastFetchedAt)}</dd>
            </div>
          </dl>
        </article>
      </section>

      <section className={styles.grid}>
        <article className={styles.card}>
          <h2>Data export</h2>
          <p className={styles.paragraph}>
            Download your feed list as an OPML file and import it into any compatible
            reader.
          </p>
          <a href="/api/feeds/export" className={styles.secondaryLink}>
            Download OPML export
          </a>
        </article>

        <article className={styles.card}>
          <h2>Danger zone</h2>
          <p className={styles.paragraph}>
            Account deletion remains disabled while we complete a full deletion flow
            across every connected system.
          </p>
          <button type="button" className={styles.dangerButton} disabled>
            Delete account (coming soon)
          </button>
        </article>
      </section>
    </div>
  );
}
