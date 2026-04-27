"use client";

import { useState } from "react";
import { TrashIcon } from "@/features/settings/components/icons";
import { resetAccount } from "@/lib/client/feeds";
import styles from "../SettingsOverview.module.css";

export function ResetAccountSection() {
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [isResettingAccount, setIsResettingAccount] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);

  async function handleResetAccount() {
    setResetError(null);
    setIsResettingAccount(true);

    const result = await resetAccount(true);
    if (result.networkError) {
      setResetError("Could not connect to the server.");
      setIsResettingAccount(false);
      return;
    }

    if (!result.ok) {
      setResetError(result.body?.error || "Could not reset account.");
      setIsResettingAccount(false);
      return;
    }

    window.location.assign("/feeds");
  }

  return (
    <section className={styles.panel}>
      <h2>Reset account</h2>
      {!showResetConfirm ? (
        <button
          type="button"
          className={`${styles.linkButton} ${styles.compactButton} ${styles.deleteAccountButton}`}
          onClick={() => setShowResetConfirm(true)}
        >
          <span className={styles.iconButtonContent}>
            <TrashIcon className={styles.buttonIcon} />
            <span>Reset account...</span>
          </span>
        </button>
      ) : (
        <div className={styles.deleteConfirm}>
          <p>
            This will permanently delete all your feeds, folders, and reading history.
            Your account will remain, but you will start fresh. This cannot be undone.
          </p>
          <div className={styles.inlineActions}>
            <button
              type="button"
              className={`${styles.linkButton} ${styles.compactButton}`}
              onClick={() => {
                void handleResetAccount();
              }}
              disabled={isResettingAccount}
            >
              <span className={styles.iconButtonContent}>
                <TrashIcon className={styles.buttonIcon} />
                <span>
                  {isResettingAccount ? "Resetting..." : "Yes, reset my account"}
                </span>
              </span>
            </button>
            <button
              type="button"
              className={styles.linkButton}
              onClick={() => {
                setShowResetConfirm(false);
                setResetError(null);
              }}
              disabled={isResettingAccount}
            >
              Cancel
            </button>
          </div>
          {resetError ? (
            <p className={styles.inlineMessageError} role="alert" aria-live="assertive">
              {resetError}
            </p>
          ) : null}
        </div>
      )}
    </section>
  );
}
