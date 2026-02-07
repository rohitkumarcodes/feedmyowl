"use client";

import { ChangeEvent, useMemo, useState } from "react";
import Link from "next/link";
import styles from "./settings-overview.module.css";

interface SettingsOverviewProps {
  email: string;
}

interface OpmlEntry {
  url: string;
  title: string;
  folderName: string | null;
}

/**
 * Parse OPML text into normalized feed entries with optional folder grouping.
 */
function parseOpmlEntries(opmlText: string): OpmlEntry[] {
  const parser = new DOMParser();
  const documentNode = parser.parseFromString(opmlText, "text/xml");

  if (documentNode.querySelector("parsererror")) {
    return [];
  }

  const entries: OpmlEntry[] = [];

  function visit(node: Element, folderName: string | null) {
    const xmlUrl = node.getAttribute("xmlUrl");
    const nodeTitle =
      node.getAttribute("title") || node.getAttribute("text") || "";

    if (xmlUrl) {
      entries.push({
        url: xmlUrl,
        title: nodeTitle || xmlUrl,
        folderName,
      });
      return;
    }

    const childOutlines = Array.from(node.children).filter(
      (child) => child.tagName.toLowerCase() === "outline"
    );

    const nextFolderName = nodeTitle.trim() ? nodeTitle.trim() : folderName;
    for (const child of childOutlines) {
      visit(child, nextFolderName);
    }
  }

  const body = documentNode.getElementsByTagName("body")[0];
  const rootOutlines = body
    ? Array.from(body.children).filter(
        (child) => child.tagName.toLowerCase() === "outline"
      )
    : [];
  for (const outline of rootOutlines) {
    visit(outline, null);
  }

  return entries;
}

/**
 * Chunk array data for progressive import requests and UI progress updates.
 */
function chunkEntries(entries: OpmlEntry[], size: number): OpmlEntry[][] {
  const chunks: OpmlEntry[][] = [];
  for (let index = 0; index < entries.length; index += size) {
    chunks.push(entries.slice(index, index + size));
  }
  return chunks;
}

/**
 * Renders minimal settings for feed import/export and account deletion.
 */
export function SettingsOverview({ email }: SettingsOverviewProps) {
  const [importMessage, setImportMessage] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const landingUrl =
    process.env.NEXT_PUBLIC_LANDING_PAGE_URL || "https://feedmyowl.com";

  const dataExportUrl = useMemo(() => "/api/feeds/export?format=json", []);
  const opmlExportUrl = useMemo(() => "/api/feeds/export?format=opml", []);

  async function handleOpmlFileSelected(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    setImportError(null);
    setImportMessage(null);

    let entries: OpmlEntry[] = [];
    try {
      const fileText = await file.text();
      entries = parseOpmlEntries(fileText);
    } catch {
      setImportError("Could not read this file.");
      return;
    }

    if (entries.length === 0) {
      setImportError("No feed URLs were found in this OPML file.");
      return;
    }

    setIsImporting(true);

    let importedCount = 0;
    let skippedCount = 0;
    let processedCount = 0;

    const chunks = chunkEntries(entries, 10);

    for (const chunk of chunks) {
      try {
        const response = await fetch("/api/feeds", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "opml.import", entries: chunk }),
        });

        const body = (await response.json()) as {
          importedCount?: number;
          skippedCount?: number;
          processedCount?: number;
          error?: string;
        };

        if (!response.ok) {
          setImportError(body.error || "Import failed.");
          setIsImporting(false);
          return;
        }

        importedCount += body.importedCount || 0;
        skippedCount += body.skippedCount || 0;
        processedCount += body.processedCount || chunk.length;

        setImportMessage(`Importing feeds… ${processedCount} of ${entries.length} complete.`);
      } catch {
        setImportError("Could not connect to the server.");
        setIsImporting(false);
        return;
      }
    }

    setIsImporting(false);
    setImportMessage(
      `Imported ${importedCount} feeds. ${skippedCount} could not be reached and were skipped.`
    );
  }

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
        <h1>Settings</h1>
        <p className={styles.muted}>Signed in as {email}</p>
        <Link href="/feeds" className={styles.linkButton}>
          Return to feeds
        </Link>
      </header>

      <section className={styles.panel}>
        <h2>Import feeds</h2>
        <p className={styles.muted}>Upload an OPML file to import subscriptions.</p>
        <label className={styles.fileLabel} htmlFor="opml-import-input">
          Choose OPML file
        </label>
        <input
          id="opml-import-input"
          type="file"
          accept=".opml,.xml,text/xml,application/xml"
          onChange={(event) => {
            void handleOpmlFileSelected(event);
          }}
          disabled={isImporting}
          className={styles.fileInput}
        />
        {importMessage ? <p className={styles.inlineMessage}>{importMessage}</p> : null}
        {importError ? <p className={styles.inlineMessage}>{importError}</p> : null}
      </section>

      <section className={styles.panel}>
        <h2>Export feeds</h2>
        <p className={styles.muted}>Download subscriptions as OPML.</p>
        <Link href={opmlExportUrl} className={styles.linkButton} prefetch={false}>
          Download OPML export
        </Link>
      </section>

      <section className={styles.panel}>
        <h2>Export all data</h2>
        <p className={styles.muted}>Download folders, feeds, and read-state as JSON.</p>
        <Link href={dataExportUrl} className={styles.linkButton} prefetch={false}>
          Download JSON export
        </Link>
      </section>

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
