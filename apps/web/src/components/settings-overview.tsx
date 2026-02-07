"use client";

import { useState } from "react";
import Link from "next/link";
import styles from "./settings-overview.module.css";

interface SettingsOverviewProps {
  email: string;
}

/**
 * Renders minimal account settings for the reading MVP.
 */
export function SettingsOverview({ email }: SettingsOverviewProps) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const landingUrl =
    process.env.NEXT_PUBLIC_LANDING_PAGE_URL || "https://feedmyowl.com";

  async function handleDeleteAccount() {
    setDeleteError(null);
    setIsDeletingAccount(true);

    try {
      const response = await fetch("/api/feeds", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "account.delete", confirm: true }),
      });

      const body = (await response.json()) as { error?: string };
      if (!response.ok) {
        setDeleteError(body.error || "Could not delete account.");
        setIsDeletingAccount(false);
        return;
      }

      window.location.assign(landingUrl);
    } catch {
      setDeleteError("Could not connect to the server.");
      setIsDeletingAccount(false);
    }
  }

  return (
    <div className={styles.root}>
      <header className={styles.header}>
        <h1>Account</h1>
        <p className={styles.muted}>Signed in as {email}</p>
        <Link href="/feeds" className={styles.linkButton}>
          Return to feeds
        </Link>
      </header>

      <section className={styles.panel}>
        <h2>Delete account</h2>
        {!showDeleteConfirm ? (
          <button
            type="button"
            className={styles.linkButton}
            onClick={() => setShowDeleteConfirm(true)}
          >
            Delete my account
          </button>
        ) : (
          <div className={styles.deleteConfirm}>
            <p>This will permanently delete your account and all data. This cannot be undone.</p>
            <div className={styles.inlineActions}>
              <button
                type="button"
                className={styles.linkButton}
                onClick={() => {
                  void handleDeleteAccount();
                }}
                disabled={isDeletingAccount}
              >
                {isDeletingAccount ? "Deleting..." : "Yes, delete my account"}
              </button>
              <button
                type="button"
                className={styles.linkButton}
                onClick={() => {
                  setShowDeleteConfirm(false);
                  setDeleteError(null);
                }}
                disabled={isDeletingAccount}
              >
                Cancel
              </button>
            </div>
            {deleteError ? <p className={styles.inlineMessage}>{deleteError}</p> : null}
          </div>
        )}
      </section>
    </div>
  );
}
