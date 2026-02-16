"use client";

import { useState } from "react";
import { TrashIcon } from "@/features/settings/components/icons";
import { deleteAccount } from "@/lib/client/feeds";
import { getLandingPageUrl } from "@/lib/shared/runtime-config";
import styles from "../SettingsOverview.module.css";

export function DeleteAccountSection() {
  const landingUrl = getLandingPageUrl();

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  async function handleDeleteAccount() {
    setDeleteError(null);
    setIsDeletingAccount(true);

    const result = await deleteAccount(true);
    if (result.networkError) {
      setDeleteError("Could not connect to the server.");
      setIsDeletingAccount(false);
      return;
    }

    if (!result.ok) {
      setDeleteError(result.body?.error || "Could not delete account.");
      setIsDeletingAccount(false);
      return;
    }

    window.location.assign(landingUrl);
  }

  return (
    <section className={styles.panel}>
      <h2>Delete account</h2>
      {!showDeleteConfirm ? (
        <button
          type="button"
          className={`${styles.linkButton} ${styles.compactButton} ${styles.deleteAccountButton}`}
          onClick={() => setShowDeleteConfirm(true)}
        >
          <span className={styles.iconButtonContent}>
            <TrashIcon className={styles.buttonIcon} />
            <span>Delete account...</span>
          </span>
        </button>
      ) : (
        <div className={styles.deleteConfirm}>
          <p>
            This will permanently delete your account and all data. This cannot be undone.
          </p>
          <div className={styles.inlineActions}>
            <button
              type="button"
              className={`${styles.linkButton} ${styles.compactButton}`}
              onClick={() => {
                void handleDeleteAccount();
              }}
              disabled={isDeletingAccount}
            >
              <span className={styles.iconButtonContent}>
                <TrashIcon className={styles.buttonIcon} />
                <span>
                  {isDeletingAccount ? "Deleting..." : "Yes, delete my account"}
                </span>
              </span>
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
          {deleteError ? (
            <p className={styles.inlineMessageError} role="alert" aria-live="assertive">
              {deleteError}
            </p>
          ) : null}
        </div>
      )}
    </section>
  );
}
