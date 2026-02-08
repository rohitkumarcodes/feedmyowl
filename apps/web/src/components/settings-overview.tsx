"use client";

import { useRef, useState, type ChangeEvent } from "react";
import Link from "next/link";
import { normalizeFeedUrl } from "@/lib/feed-url";
import styles from "./settings-overview.module.css";

interface SettingsOverviewProps {
  email: string;
}

interface ImportResponseBody {
  error?: string;
  duplicate?: boolean;
}

interface ParsedImportFile {
  urls: string[];
  sourceType: "OPML" | "JSON";
}

interface ImportSummary {
  fileName: string;
  sourceType: "OPML" | "JSON";
  discoveredCount: number;
  processedCount: number;
  importedCount: number;
  duplicateCount: number;
  failedCount: number;
  failedDetails: string[];
}

/**
 * Safely parse JSON response bodies.
 */
async function parseResponseJson<T>(response: Response): Promise<T | null> {
  try {
    return (await response.json()) as T;
  } catch {
    return null;
  }
}

/**
 * Parse feed URLs from OPML/XML outline nodes.
 */
function parseOpmlFeedUrls(contents: string): string[] {
  const xmlDoc = new DOMParser().parseFromString(contents, "text/xml");

  if (xmlDoc.querySelector("parsererror")) {
    throw new Error("This OPML/XML file could not be parsed.");
  }

  return Array.from(xmlDoc.querySelectorAll("outline"))
    .map(
      (outline) =>
        outline.getAttribute("xmlUrl") || outline.getAttribute("xmlurl") || ""
    )
    .map((value) => value.trim())
    .filter((value) => value.length > 0);
}

/**
 * Parse feed URLs from FeedMyOwl exported JSON.
 */
function parseJsonFeedUrls(contents: string): string[] {
  let parsed: unknown;

  try {
    parsed = JSON.parse(contents);
  } catch {
    throw new Error("This JSON file could not be parsed.");
  }

  if (!parsed || typeof parsed !== "object") {
    throw new Error("This JSON file does not contain feed export data.");
  }

  const feedsValue = (parsed as { feeds?: unknown }).feeds;
  if (!Array.isArray(feedsValue)) {
    throw new Error("This JSON file does not contain a valid feeds array.");
  }

  return feedsValue
    .map((feed) => {
      if (!feed || typeof feed !== "object") {
        return "";
      }

      const url = (feed as { url?: unknown }).url;
      return typeof url === "string" ? url.trim() : "";
    })
    .filter((value) => value.length > 0);
}

/**
 * Normalize and deduplicate imported URLs.
 */
function normalizeAndDedupeUrls(urls: string[]): string[] {
  const seen = new Set<string>();
  const normalizedUrls: string[] = [];

  for (const url of urls) {
    const normalized = normalizeFeedUrl(url);
    if (!normalized || seen.has(normalized)) {
      continue;
    }

    seen.add(normalized);
    normalizedUrls.push(normalized);
  }

  return normalizedUrls;
}

/**
 * Parse one selected import file into feed URLs.
 */
async function parseImportFile(file: File): Promise<ParsedImportFile> {
  const fileName = file.name.toLowerCase();
  const contents = await file.text();

  if (fileName.endsWith(".json")) {
    return {
      urls: parseJsonFeedUrls(contents),
      sourceType: "JSON",
    };
  }

  if (fileName.endsWith(".opml") || fileName.endsWith(".xml")) {
    return {
      urls: parseOpmlFeedUrls(contents),
      sourceType: "OPML",
    };
  }

  throw new Error("Unsupported file type. Use .opml, .xml, or .json.");
}

/**
 * Renders minimal account settings for the reading MVP.
 */
export function SettingsOverview({ email }: SettingsOverviewProps) {
  const importFileInputRef = useRef<HTMLInputElement | null>(null);

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isImportingFeeds, setIsImportingFeeds] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [importSummary, setImportSummary] = useState<ImportSummary | null>(null);

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

  function handleExport(format: "opml" | "json") {
    window.location.assign(`/api/feeds/export?format=${format}`);
  }

  async function handleImportFileChange(event: ChangeEvent<HTMLInputElement>) {
    const selectedFile = event.currentTarget.files?.[0];
    event.currentTarget.value = "";

    if (!selectedFile) {
      return;
    }

    setImportError(null);
    setImportSummary(null);
    setIsImportingFeeds(true);

    try {
      const parsedFile = await parseImportFile(selectedFile);
      const normalizedUrls = normalizeAndDedupeUrls(parsedFile.urls);

      if (normalizedUrls.length === 0) {
        setImportError("No valid feed URLs were found in the selected file.");
        return;
      }

      let importedCount = 0;
      let duplicateCount = 0;
      let failedCount = 0;
      const failedDetails: string[] = [];

      for (const url of normalizedUrls) {
        try {
          const response = await fetch("/api/feeds", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              action: "feed.create",
              url,
            }),
          });

          const body = await parseResponseJson<ImportResponseBody>(response);

          if (!response.ok) {
            failedCount += 1;
            if (failedDetails.length < 5) {
              failedDetails.push(`${url} — ${body?.error || "Could not import."}`);
            }
            continue;
          }

          if (body?.duplicate) {
            duplicateCount += 1;
          } else {
            importedCount += 1;
          }
        } catch {
          failedCount += 1;
          if (failedDetails.length < 5) {
            failedDetails.push(`${url} — Could not connect to the server.`);
          }
        }
      }

      setImportSummary({
        fileName: selectedFile.name,
        sourceType: parsedFile.sourceType,
        discoveredCount: parsedFile.urls.length,
        processedCount: normalizedUrls.length,
        importedCount,
        duplicateCount,
        failedCount,
        failedDetails,
      });
    } catch (error) {
      setImportError(
        error instanceof Error
          ? error.message
          : "Could not read the selected import file."
      );
    } finally {
      setIsImportingFeeds(false);
    }
  }

  const importSummaryText = importSummary
    ? `Processed ${importSummary.processedCount} unique valid URL${
        importSummary.processedCount === 1 ? "" : "s"
      } from ${importSummary.sourceType} import (${importSummary.discoveredCount} discovered). Imported ${importSummary.importedCount}, skipped ${importSummary.duplicateCount} duplicate${
        importSummary.duplicateCount === 1 ? "" : "s"
      }, and failed ${importSummary.failedCount}.`
    : null;

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
        <h2>Feeds</h2>
        <p className={styles.muted}>
          Export your library or import feeds from OPML/XML or FeedMyOwl JSON.
        </p>
        <div className={styles.inlineActions}>
          <button
            type="button"
            className={styles.linkButton}
            onClick={() => handleExport("opml")}
          >
            Export OPML
          </button>
          <button
            type="button"
            className={styles.linkButton}
            onClick={() => handleExport("json")}
          >
            Export JSON
          </button>
          <button
            type="button"
            className={styles.linkButton}
            onClick={() => importFileInputRef.current?.click()}
            disabled={isImportingFeeds}
          >
            {isImportingFeeds ? "Importing..." : "Import feeds"}
          </button>
        </div>
        <input
          ref={importFileInputRef}
          className={styles.hiddenFileInput}
          type="file"
          accept=".opml,.xml,.json,application/xml,text/xml,application/json"
          onChange={(event) => {
            void handleImportFileChange(event);
          }}
        />
        {importError ? <p className={styles.inlineMessage}>{importError}</p> : null}
        {importSummary && importSummaryText ? (
          <div className={styles.importSummary} role="status">
            <p>{importSummaryText}</p>
            <p className={styles.muted}>Source file: {importSummary.fileName}</p>
            {importSummary.failedDetails.length > 0 ? (
              <ul className={styles.importFailureList}>
                {importSummary.failedDetails.map((detail) => (
                  <li key={detail}>{detail}</li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}
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
