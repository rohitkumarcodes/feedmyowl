import Link from "next/link";
import { ImportSection } from "@/features/settings/components/sections/ImportSection";
import { BackIcon } from "@/features/settings/components/icons";
import styles from "@/features/settings/components/SettingsOverview.module.css";

/**
 * First-run screen that gives new readers a direct import path before the
 * normal feed workspace.
 */
export function OnboardingOverview() {
  return (
    <div className={styles.root}>
      <header className={styles.header}>
        <div className={styles.headerTopRow}>
          <h1>Set up your feeds</h1>
          <Link href="/feeds" className={`${styles.linkButton} ${styles.compactButton}`}>
            <span className={styles.iconButtonContent}>
              <BackIcon className={styles.buttonIcon} />
              <span>Skip for now</span>
            </span>
          </Link>
        </div>
        <p className={styles.muted}>Import an OPML, XML, or FeedMyOwl JSON backup.</p>
      </header>

      <div className={styles.settingsOptions}>
        <ImportSection />
        <section className={styles.panel}>
          <h2>Continue reading</h2>
          <Link href="/feeds" className={`${styles.linkButton} ${styles.compactButton}`}>
            Open feeds
          </Link>
        </section>
      </div>
    </div>
  );
}
