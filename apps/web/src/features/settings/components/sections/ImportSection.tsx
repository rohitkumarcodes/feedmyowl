"use client";

import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import {
  chunkImportEntries,
  summarizeImportRows,
  type FeedImportRowSummary,
} from "@/lib/shared/feed-import-file";
import {
  IMPORT_RATE_LIMIT_MAX_RETRIES,
  buildChunkFallbackRows,
  buildImportFailureReport,
  isImportFailureRow,
  parseRetryAfterSeconds,
  reconcileChunkRowsByUrl,
} from "@/lib/shared/feed-import-client";
import {
  FEED_IMPORT_CLIENT_CHUNK_SIZE,
  FEED_IMPORT_MAX_FILE_SIZE_BYTES,
  type FeedImportPreview,
  type FeedImportResponse,
  type FeedImportRowResult,
  type FeedImportSourceType,
} from "@/lib/shared/feed-import-types";
import { importFeedEntriesChunk, previewFeedImport } from "@/lib/client/feeds";
import styles from "../SettingsOverview.module.css";

interface ImportSummary {
  fileName: string;
  sourceType: FeedImportSourceType;
  discoveredCount: number;
  summary: FeedImportRowSummary;
  failedRows: FeedImportRowResult[];
  warningRows: FeedImportRowResult[];
}

interface ImportProgress {
  processedCount: number;
  totalCount: number;
}

export function ImportSection() {
  const router = useRouter();

  const importFileInputRef = useRef<HTMLInputElement | null>(null);

  const [isImportingFeeds, setIsImportingFeeds] = useState(false);
  const [importProgress, setImportProgress] = useState<ImportProgress | null>(null);
  const [importRetryDelaySeconds, setImportRetryDelaySeconds] = useState<number | null>(
    null,
  );
  const [importRetryCountdown, setImportRetryCountdown] = useState<number | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [importSummary, setImportSummary] = useState<ImportSummary | null>(null);
  const [importPreview, setImportPreview] = useState<FeedImportPreview | null>(null);
  const [, setIsLoadingPreview] = useState(false);
  const [isDraggingFile, setIsDraggingFile] = useState(false);
  const [showPreviewList, setShowPreviewList] = useState(false);

  // Live countdown for rate-limit retry delay.
  useEffect(() => {
    if (importRetryDelaySeconds === null) {
      setImportRetryCountdown(null);
      return;
    }

    setImportRetryCountdown(importRetryDelaySeconds);
    const interval = window.setInterval(() => {
      setImportRetryCountdown((previous) => {
        if (previous === null || previous <= 1) {
          return null;
        }
        return previous - 1;
      });
    }, 1_000);

    return () => {
      window.clearInterval(interval);
    };
  }, [importRetryDelaySeconds]);

  /**
   * Phase 1: Parse the selected file and get a preview from the server.
   */
  async function handleImportFileChange(event: ChangeEvent<HTMLInputElement>) {
    const selectedFile = event.currentTarget.files?.[0];
    event.currentTarget.value = "";

    if (!selectedFile) {
      return;
    }

    setImportError(null);
    setImportSummary(null);
    setImportProgress(null);
    setImportRetryDelaySeconds(null);
    setImportPreview(null);
    setIsLoadingPreview(true);

    try {
      // Reject oversized files before reading into memory.
      if (selectedFile.size > FEED_IMPORT_MAX_FILE_SIZE_BYTES) {
        const maxMb = Math.round(FEED_IMPORT_MAX_FILE_SIZE_BYTES / (1024 * 1024));
        setImportError(
          `This file is too large (${(selectedFile.size / (1024 * 1024)).toFixed(1)} MB). The maximum allowed size is ${maxMb} MB.`,
        );
        return;
      }

      const fileContents = await selectedFile.text();

      // Send to preview API for server-side validation
      const result = await previewFeedImport(selectedFile.name, fileContents);
      if (result.networkError) {
        setImportError("Could not connect to the server.");
        return;
      }

      if (!result.ok || !result.body || !("entries" in result.body)) {
        setImportError(result.body?.error || "Could not generate import preview.");
        return;
      }

      setImportPreview(result.body);
    } catch (error) {
      setImportError(
        error instanceof Error
          ? error.message
          : "Could not read the selected import file.",
      );
    } finally {
      setIsLoadingPreview(false);
    }
  }

  /**
   * Phase 2: Run the actual import after the user confirms the preview.
   */
  async function handleConfirmImport() {
    if (!importPreview) return;

    const { entries: normalizedEntries, sourceType, fileName } = importPreview;
    setImportPreview(null);
    setIsImportingFeeds(true);

    try {
      const chunks = chunkImportEntries(normalizedEntries, FEED_IMPORT_CLIENT_CHUNK_SIZE);
      const allRows: FeedImportRowResult[] = [];
      let processedCount = 0;

      setImportProgress({ processedCount: 0, totalCount: normalizedEntries.length });

      for (const chunk of chunks) {
        let chunkRows: FeedImportRowResult[] | null = null;
        let attempt = 0;

        while (attempt <= IMPORT_RATE_LIMIT_MAX_RETRIES) {
          const result = await importFeedEntriesChunk({
            sourceType,
            entries: chunk,
            options: { skipMultiCandidate: true },
          });

          if (
            result.ok &&
            result.body &&
            Array.isArray((result.body as FeedImportResponse).rows)
          ) {
            chunkRows = reconcileChunkRowsByUrl({
              entries: chunk,
              rows: (result.body as FeedImportResponse).rows,
              fallbackMessage: "Could not import this row.",
            });
            break;
          }

          if (result.status === 429 && attempt < IMPORT_RATE_LIMIT_MAX_RETRIES) {
            const retryAfterSeconds = parseRetryAfterSeconds(
              result.headers?.get("Retry-After") ?? null,
            );
            setImportRetryDelaySeconds(retryAfterSeconds);
            await new Promise((resolve) => {
              window.setTimeout(resolve, retryAfterSeconds * 1_000);
            });
            setImportRetryDelaySeconds(null);
            attempt += 1;
            continue;
          }

          if (result.networkError) {
            chunkRows = buildChunkFallbackRows(chunk, "Could not connect to the server.");
            break;
          }

          const requestErrorMessage =
            (result.body as { error?: string } | null)?.error ||
            `Failed to import ${chunk.length} feeds. Download diagnostics for details.`;
          chunkRows = buildChunkFallbackRows(chunk, requestErrorMessage);
          break;
        }

        allRows.push(
          ...(chunkRows || buildChunkFallbackRows(chunk, "Could not import this chunk.")),
        );
        processedCount += chunk.length;
        setImportProgress({
          processedCount,
          totalCount: normalizedEntries.length,
        });
      }

      const summary = summarizeImportRows(allRows);
      const failedRows = allRows.filter(isImportFailureRow);
      const warningRows = allRows.filter(
        (row) => Array.isArray(row.warnings) && row.warnings.length > 0,
      );
      setImportSummary({
        fileName,
        sourceType,
        discoveredCount: normalizedEntries.length,
        summary,
        failedRows,
        warningRows,
      });

      if (summary.importedCount > 0 || summary.mergedCount > 0) {
        router.refresh();
      }
    } catch (error) {
      setImportError(
        error instanceof Error
          ? error.message
          : "Could not read the selected import file.",
      );
    } finally {
      setIsImportingFeeds(false);
      setImportProgress(null);
      setImportRetryDelaySeconds(null);
    }
  }

  function handleCancelImport() {
    setImportPreview(null);
  }

  function handleDragOver(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsDraggingFile(true);
  }

  function handleDragLeave(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsDraggingFile(false);
  }

  function handleDrop(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsDraggingFile(false);

    const files = event.dataTransfer.files;
    if (files.length > 0) {
      const file = files[0];
      const dataTransfer = new DataTransfer();
      dataTransfer.items.add(file);

      const input = importFileInputRef.current;
      if (input) {
        input.files = dataTransfer.files;
        const changeEvent = {
          currentTarget: input,
        } as ChangeEvent<HTMLInputElement>;
        void handleImportFileChange(changeEvent);
      }
    }
  }

  function handleDoneImport() {
    setImportSummary(null);
    setImportPreview(null);
    router.refresh();
  }

  function handleDownloadFailedImportRows() {
    if (
      !importSummary ||
      (importSummary.failedRows.length === 0 && importSummary.warningRows.length === 0)
    ) {
      return;
    }

    const reportText = buildImportFailureReport({
      fileName: importSummary.fileName,
      failedRows: importSummary.failedRows,
      warningRows: importSummary.warningRows,
    });
    const reportBlob = new Blob([reportText], { type: "text/plain;charset=utf-8" });
    const downloadUrl = URL.createObjectURL(reportBlob);
    const link = document.createElement("a");
    const baseFileName = importSummary.fileName.replace(/\\.[^/.]+$/, "") || "feeds";
    const dateStamp = new Date().toISOString().slice(0, 10);

    link.href = downloadUrl;
    link.download = `feedmyowl-import-diagnostics-${baseFileName}-${dateStamp}.txt`;
    document.body.append(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(downloadUrl);
  }

  const importSummaryText = importSummary
    ? `Processed ${importSummary.summary.processedCount} unique valid URL${
        importSummary.summary.processedCount === 1 ? "" : "s"
      } from ${importSummary.sourceType} import (${importSummary.discoveredCount} discovered). Imported ${importSummary.summary.importedCount}, merged ${importSummary.summary.mergedCount} duplicate folder assignment${
        importSummary.summary.mergedCount === 1 ? "" : "s"
      }, kept ${importSummary.summary.duplicateCount - importSummary.summary.mergedCount} duplicate${
        importSummary.summary.duplicateCount - importSummary.summary.mergedCount === 1
          ? ""
          : "s"
      } unchanged, and failed ${importSummary.summary.failedCount}.${
        importSummary.summary.skippedMultipleCount > 0
          ? ` ${importSummary.summary.skippedMultipleCount} entr${
              importSummary.summary.skippedMultipleCount === 1 ? "y" : "ies"
            } require manual feed selection.`
          : ""
      }${
        importSummary.summary.warningCount > 0
          ? ` Reported ${importSummary.summary.warningCount} warning${
              importSummary.summary.warningCount === 1 ? "" : "s"
            }.`
          : ""
      }`
    : null;

  return (
    <section className={styles.panel}>
      <h2>Import feeds</h2>
      <p className={styles.feedsSectionDescription}>Supports OPML, XML, or JSON files.</p>
      <div className={styles.feedsImportSection}>
        <div
          className={`${styles.dropZone} ${isDraggingFile ? styles.dropZoneDragOver : ""}`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => importFileInputRef.current?.click()}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              importFileInputRef.current?.click();
            }
          }}
        >
          <p className={styles.dropZoneText}>
            <span className={styles.dropZoneTextAccent}>Click to upload</span> or drag and
            drop
          </p>
          <p className={styles.dropZoneText}>(max 10 MB)</p>
        </div>
      </div>
      {importPreview ? (
        <div className={styles.importSummary} role="status">
          <p>
            Found {importPreview.totalCount} feed
            {importPreview.totalCount === 1 ? "" : "s"}
            {importPreview.folderNames.length > 0
              ? ` in ${importPreview.folderNames.length} folder${
                  importPreview.folderNames.length === 1 ? "" : "s"
                }`
              : ""}
            . Detected format: {importPreview.sourceType}.
          </p>
          <p className={styles.muted}>Source file: {importPreview.fileName}</p>
          {importPreview.totalCount > 0 && (
            <button
              type="button"
              className={styles.linkButton}
              onClick={() => setShowPreviewList(!showPreviewList)}
            >
              {showPreviewList ? "Hide" : "Show"} feed list ({importPreview.totalCount})
            </button>
          )}
          {showPreviewList && (
            <div className={styles.importPreviewList}>
              {importPreview.entries.slice(0, 50).map((entry, index) => (
                <div key={index} className={styles.importPreviewEntry}>
                  <div className={styles.importPreviewEntryStatus}>
                    {entry.status === "new" && (
                      <span className={styles.importPreviewEntryNew}>New</span>
                    )}
                    {entry.status === "duplicate" && (
                      <span className={styles.importPreviewEntryDuplicate}>
                        Duplicate
                      </span>
                    )}
                    {entry.status === "error" && (
                      <span className={styles.importPreviewEntryError}>Error</span>
                    )}
                  </div>
                  <div className={styles.importPreviewEntryUrl}>{entry.url}</div>
                  {entry.customTitle && (
                    <div className={styles.importPreviewEntryTitle}>
                      {entry.customTitle}
                    </div>
                  )}
                  {entry.folderNames.length > 0 && (
                    <div className={styles.importPreviewEntryFolders}>
                      {entry.folderNames.map((folder) => (
                        <span key={folder} className={styles.importPreviewFolder}>
                          {folder}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
              {importPreview.entries.length > 50 && (
                <p className={styles.muted}>
                  ...and {importPreview.entries.length - 50} more feeds
                </p>
              )}
            </div>
          )}
          <div className={styles.inlineActions}>
            <button
              type="button"
              className={styles.linkButton}
              onClick={() => {
                void handleConfirmImport();
              }}
            >
              Import now
            </button>
            <button
              type="button"
              className={styles.linkButton}
              onClick={handleCancelImport}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}
      {isImportingFeeds && importProgress ? (
        <>
          <p className={styles.importProgress} role="status" aria-live="polite">
            Importing {importProgress.processedCount} of {importProgress.totalCount} feed
            URL
            {importProgress.totalCount === 1 ? "" : "s"}...
          </p>
          <div
            className={styles.progressBarContainer}
            role="progressbar"
            aria-valuenow={importProgress.processedCount}
            aria-valuemin={0}
            aria-valuemax={importProgress.totalCount}
          >
            <div
              className={styles.progressBar}
              style={{
                width: `${(importProgress.processedCount / importProgress.totalCount) * 100}%`,
              }}
            />
          </div>
          {importRetryCountdown !== null ? (
            <p className={styles.importProgress} role="status" aria-live="polite">
              Server busy. Retrying in {importRetryCountdown} second
              {importRetryCountdown === 1 ? "" : "s"}...
            </p>
          ) : null}
        </>
      ) : null}
      <input
        ref={importFileInputRef}
        className={styles.hiddenFileInput}
        type="file"
        accept=".opml,.xml,.json,application/xml,text/xml,application/json"
        onChange={(event) => {
          void handleImportFileChange(event);
        }}
      />
      {importError ? (
        <p className={styles.inlineMessageError} role="alert" aria-live="assertive">
          {importError}
        </p>
      ) : null}
      {importSummary && importSummaryText ? (
        <div className={styles.importSummary} role="status">
          <p className={styles.muted}>Source file: {importSummary.fileName}</p>
          <div className={styles.importSummaryList}>
            {importSummary.summary.importedCount > 0 && (
              <span
                className={`${styles.importSummaryItem} ${styles.importSummaryItemSuccess}`}
              >
                {importSummary.summary.importedCount} new
              </span>
            )}
            {importSummary.summary.mergedCount > 0 && (
              <span
                className={`${styles.importSummaryItem} ${styles.importSummaryItemWarning}`}
              >
                {importSummary.summary.mergedCount} merged
              </span>
            )}
            {importSummary.summary.failedCount > 0 && (
              <span
                className={`${styles.importSummaryItem} ${styles.importSummaryItemError}`}
              >
                {importSummary.summary.failedCount} failed
              </span>
            )}
          </div>
          {(importSummary.summary.processedCount === 0 ||
            importSummary.summary.importedCount > 0 ||
            importSummary.summary.mergedCount > 0) && (
            <button
              type="button"
              className={styles.doneButton}
              onClick={handleDoneImport}
            >
              Done
            </button>
          )}
          {importSummary.failedRows.length > 0 || importSummary.warningRows.length > 0 ? (
            <button
              type="button"
              className={`${styles.linkButton} ${styles.downloadFailuresButton}`}
              onClick={handleDownloadFailedImportRows}
            >
              Download import diagnostics
            </button>
          ) : null}
          {importSummary.summary.failedDetails.length > 0 ? (
            <ul className={styles.importFailureList}>
              {importSummary.summary.failedDetails.map((detail) => (
                <li key={detail}>{detail}</li>
              ))}
            </ul>
          ) : null}
          {importSummary.summary.warningDetails.length > 0 ? (
            <ul className={styles.importFailureList}>
              {importSummary.summary.warningDetails.map((detail) => (
                <li key={`warn-${detail}`}>{detail}</li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
