"use client";

import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ChangeEvent,
  type ReactNode,
  type TransitionEvent,
} from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  chunkImportEntries,
  normalizeAndMergeImportEntries,
  parseImportFileContents,
  summarizeImportRows,
  type FeedImportRowSummary,
} from "@/lib/feed-import-file";
import {
  FEED_IMPORT_CLIENT_CHUNK_SIZE,
  FEED_IMPORT_MAX_TOTAL_ENTRIES,
  type FeedImportResponse,
  type FeedImportRowResult,
  type FeedImportSourceType,
} from "@/lib/feed-import-types";
import { OWL_ART_OPTIONS, coerceOwlAscii, type OwlAscii } from "@/lib/owl-brand";
import { SHORTCUT_GROUPS } from "./keyboard-shortcuts";
import styles from "./settings-overview.module.css";

interface SettingsOverviewProps {
  email: string;
  owlAscii: OwlAscii;
}

interface ImportRequestErrorBody {
  error?: string;
}

interface SaveOwlResponseBody {
  error?: string;
  owlAscii?: string;
}

interface OwlOptionsShutterProps {
  expanded: boolean;
  prefersReducedMotion: boolean;
  contentId: string;
  children: ReactNode;
}

interface ImportSummary {
  fileName: string;
  sourceType: FeedImportSourceType;
  discoveredCount: number;
  summary: FeedImportRowSummary;
}

interface ImportProgress {
  processedCount: number;
  totalCount: number;
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

function usePrefersReducedMotion(): boolean {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
      return;
    }

    const mediaQueryList = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updatePreference = (event?: MediaQueryListEvent) => {
      setPrefersReducedMotion(event ? event.matches : mediaQueryList.matches);
    };

    updatePreference();

    if (typeof mediaQueryList.addEventListener === "function") {
      mediaQueryList.addEventListener("change", updatePreference);
      return () => {
        mediaQueryList.removeEventListener("change", updatePreference);
      };
    }

    mediaQueryList.addListener(updatePreference);
    return () => {
      mediaQueryList.removeListener(updatePreference);
    };
  }, []);

  return prefersReducedMotion;
}

function OwlOptionsShutter({
  expanded,
  prefersReducedMotion,
  contentId,
  children,
}: OwlOptionsShutterProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const animationFrameRef = useRef<number | null>(null);
  const [isRendered, setIsRendered] = useState(expanded);
  const [heightPx, setHeightPx] = useState<string>(expanded ? "auto" : "0px");

  useEffect(() => {
    return () => {
      if (animationFrameRef.current !== null) {
        window.cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (animationFrameRef.current !== null) {
      window.cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    if (prefersReducedMotion) {
      if (expanded) {
        setIsRendered(true);
        setHeightPx("auto");
      } else {
        setHeightPx("0px");
        setIsRendered(false);
      }
      return;
    }

    if (expanded && !isRendered) {
      setIsRendered(true);
      setHeightPx("0px");
      return;
    }

    if (!isRendered) {
      return;
    }

    const container = containerRef.current;
    const content = contentRef.current;
    if (!container || !content) {
      return;
    }

    const startHeight = container.getBoundingClientRect().height;
    const endHeight = expanded ? content.scrollHeight : 0;

    if (expanded && startHeight === endHeight) {
      setHeightPx("auto");
      return;
    }

    if (!expanded && startHeight === 0) {
      setHeightPx("0px");
      setIsRendered(false);
      return;
    }

    setHeightPx(`${startHeight}px`);
    animationFrameRef.current = window.requestAnimationFrame(() => {
      setHeightPx(`${endHeight}px`);
      animationFrameRef.current = null;
    });
  }, [expanded, isRendered, prefersReducedMotion]);

  const handleTransitionEnd = (event: TransitionEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget || event.propertyName !== "height") {
      return;
    }

    if (expanded) {
      setHeightPx("auto");
      return;
    }

    setHeightPx("0px");
    setIsRendered(false);
  };

  const isFullyExpanded = expanded && isRendered && heightPx === "auto";

  return (
    <div
      id={contentId}
      ref={containerRef}
      className={styles.owlOptionsShutter}
      style={{
        height: isRendered ? heightPx : "0px",
        overflow: isFullyExpanded ? "visible" : "hidden",
      }}
      onTransitionEnd={handleTransitionEnd}
      aria-hidden={!expanded}
    >
      {isRendered ? (
        <div ref={contentRef} className={styles.owlOptionsShutterContent}>
          {children}
        </div>
      ) : null}
    </div>
  );
}

const backIcon = (
  <svg
    className={styles.buttonIcon}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
  >
    <path
      d="M10 6L4 12L10 18"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M5 12H20"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const trashIcon = (
  <svg
    className={styles.buttonIcon}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
  >
    <path
      d="M4 7H20"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M9 7V5.8C9 5.36 9.36 5 9.8 5H14.2C14.64 5 15 5.36 15 5.8V7"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M7.5 7L8.2 18.2C8.25 18.96 8.88 19.55 9.65 19.55H14.35C15.12 19.55 15.75 18.96 15.8 18.2L16.5 7"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path d="M10 10.2V16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    <path d="M14 10.2V16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
  </svg>
);

const keyboardIcon = (
  <svg
    className={styles.buttonIcon}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
  >
    <rect
      x="3.5"
      y="6.5"
      width="17"
      height="11"
      rx="1.4"
      stroke="currentColor"
      strokeWidth="1.8"
    />
    <path d="M7 10H8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    <path d="M10 10H11" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    <path d="M13 10H14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    <path d="M16 10H17" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    <path d="M7 13.5H17" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
  </svg>
);

/**
 * Renders minimal account settings for the reading MVP.
 */
export function SettingsOverview({ email, owlAscii }: SettingsOverviewProps) {
  const router = useRouter();
  const owlOptionsPanelId = useId();
  const shortcutsPanelId = useId();
  const importFileInputRef = useRef<HTMLInputElement | null>(null);
  const owlControlsRef = useRef<HTMLDivElement | null>(null);
  const shortcutsControlsRef = useRef<HTMLDivElement | null>(null);
  const owlWidthProbeRef = useRef<HTMLDivElement | null>(null);
  const shortcutsWidthProbeRef = useRef<HTMLDivElement | null>(null);
  const prefersReducedMotion = usePrefersReducedMotion();

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isImportingFeeds, setIsImportingFeeds] = useState(false);
  const [importProgress, setImportProgress] = useState<ImportProgress | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [importSummary, setImportSummary] = useState<ImportSummary | null>(null);
  const [draftOwlAscii, setDraftOwlAscii] = useState<OwlAscii>(owlAscii);
  const [savedOwlAscii, setSavedOwlAscii] = useState<OwlAscii>(owlAscii);
  const [isSavingOwl, setIsSavingOwl] = useState(false);
  const [owlSaveMessage, setOwlSaveMessage] = useState<string | null>(null);
  const [owlSaveError, setOwlSaveError] = useState<string | null>(null);
  const [isOwlPanelExpanded, setIsOwlPanelExpanded] = useState(false);
  const [isShortcutsPanelExpanded, setIsShortcutsPanelExpanded] = useState(false);
  const [owlControlsWidthPx, setOwlControlsWidthPx] = useState<number | null>(null);
  const [shortcutsControlsWidthPx, setShortcutsControlsWidthPx] = useState<number | null>(
    null
  );

  const landingUrl =
    process.env.NEXT_PUBLIC_LANDING_PAGE_URL || "https://feedmyowl.com";

  useEffect(() => {
    setDraftOwlAscii(owlAscii);
    setSavedOwlAscii(owlAscii);
  }, [owlAscii]);

  useEffect(() => {
    if (!isOwlPanelExpanded && !isShortcutsPanelExpanded) {
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) {
        return;
      }

      const clickedInsideOwl = owlControlsRef.current?.contains(target) ?? false;
      const clickedInsideShortcuts =
        shortcutsControlsRef.current?.contains(target) ?? false;

      if (clickedInsideOwl || clickedInsideShortcuts) {
        return;
      }

      setIsOwlPanelExpanded(false);
      setIsShortcutsPanelExpanded(false);
    };

    document.addEventListener("pointerdown", handlePointerDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
    };
  }, [isOwlPanelExpanded, isShortcutsPanelExpanded]);

  useLayoutEffect(() => {
    const probe = owlWidthProbeRef.current;
    if (!probe) {
      return;
    }

    const measure = () => {
      const measuredWidth = Math.ceil(probe.getBoundingClientRect().width);
      if (measuredWidth <= 0) {
        return;
      }

      setOwlControlsWidthPx((previousWidth) =>
        previousWidth === measuredWidth ? previousWidth : measuredWidth
      );
    };

    measure();
    const animationFrame = window.requestAnimationFrame(measure);

    const resizeObserver =
      typeof ResizeObserver === "function"
        ? new ResizeObserver(() => {
            measure();
          })
        : null;

    resizeObserver?.observe(probe);

    return () => {
      window.cancelAnimationFrame(animationFrame);
      resizeObserver?.disconnect();
    };
  }, []);

  useLayoutEffect(() => {
    const probe = shortcutsWidthProbeRef.current;
    if (!probe) {
      return;
    }

    const measure = () => {
      const measuredWidth = Math.ceil(probe.getBoundingClientRect().width);
      if (measuredWidth <= 0) {
        return;
      }

      setShortcutsControlsWidthPx((previousWidth) =>
        previousWidth === measuredWidth ? previousWidth : measuredWidth
      );
    };

    measure();
    const animationFrame = window.requestAnimationFrame(measure);

    const resizeObserver =
      typeof ResizeObserver === "function"
        ? new ResizeObserver(() => {
            measure();
          })
        : null;

    resizeObserver?.observe(probe);

    return () => {
      window.cancelAnimationFrame(animationFrame);
      resizeObserver?.disconnect();
    };
  }, []);

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

  async function handleSaveOwl() {
    setOwlSaveError(null);
    setOwlSaveMessage(null);
    setIsSavingOwl(true);

    try {
      const response = await fetch("/api/settings/logo", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ owlAscii: draftOwlAscii }),
      });

      const body = await parseResponseJson<SaveOwlResponseBody>(response);

      if (!response.ok) {
        setOwlSaveError(body?.error || "Could not save owl selection.");
        return;
      }

      const persistedOwl = body?.owlAscii
        ? coerceOwlAscii(body.owlAscii)
        : draftOwlAscii;

      setDraftOwlAscii(persistedOwl);
      setSavedOwlAscii(persistedOwl);
      setOwlSaveMessage("Owl updated.");
      router.refresh();
    } catch {
      setOwlSaveError("Could not connect to the server.");
    } finally {
      setIsSavingOwl(false);
    }
  }

  async function handleImportFileChange(event: ChangeEvent<HTMLInputElement>) {
    const selectedFile = event.currentTarget.files?.[0];
    event.currentTarget.value = "";

    if (!selectedFile) {
      return;
    }

    setImportError(null);
    setImportSummary(null);
    setImportProgress(null);
    setIsImportingFeeds(true);

    try {
      const parsedFile = parseImportFileContents(
        selectedFile.name,
        await selectedFile.text()
      );
      const normalizedEntries = normalizeAndMergeImportEntries(parsedFile.entries);

      if (normalizedEntries.length === 0) {
        setImportError("No valid feed URLs were found in the selected file.");
        return;
      }

      if (normalizedEntries.length > FEED_IMPORT_MAX_TOTAL_ENTRIES) {
        setImportError(
          `This file contains ${normalizedEntries.length} unique valid URLs. Import up to ${FEED_IMPORT_MAX_TOTAL_ENTRIES} at a time.`
        );
        return;
      }

      const chunks = chunkImportEntries(
        normalizedEntries,
        FEED_IMPORT_CLIENT_CHUNK_SIZE
      );
      const allRows: FeedImportRowResult[] = [];
      let processedCount = 0;

      setImportProgress({ processedCount: 0, totalCount: normalizedEntries.length });

      for (const chunk of chunks) {
        const fallbackRows = chunk.map(
          (entry): FeedImportRowResult => ({
            url: entry.url,
            status: "failed",
            code: "unknown",
            message: "Could not import.",
          })
        );

        try {
          const response = await fetch("/api/feeds/import", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              sourceType: parsedFile.sourceType,
              entries: chunk,
              options: { skipMultiCandidate: true },
            }),
          });

          const body = await parseResponseJson<
            FeedImportResponse & ImportRequestErrorBody
          >(response);

          if (!response.ok || !body || !Array.isArray(body.rows)) {
            const requestErrorMessage = body?.error || "Could not import this chunk.";
            allRows.push(
              ...fallbackRows.map((row) => ({
                ...row,
                message: requestErrorMessage,
              }))
            );
          } else {
            const parsedRows = body.rows.filter(
              (row): row is FeedImportRowResult =>
                Boolean(
                  row &&
                    typeof row === "object" &&
                    typeof row.url === "string" &&
                    typeof row.status === "string"
                )
            );

            allRows.push(...parsedRows);

            if (parsedRows.length < chunk.length) {
              allRows.push(...fallbackRows.slice(parsedRows.length));
            }
          }
        } catch {
          allRows.push(
            ...fallbackRows.map((row) => ({
              ...row,
              message: "Could not connect to the server.",
            }))
          );
        }

        processedCount += chunk.length;
        setImportProgress({
          processedCount,
          totalCount: normalizedEntries.length,
        });
      }

      const summary = summarizeImportRows(allRows);
      setImportSummary({
        fileName: selectedFile.name,
        sourceType: parsedFile.sourceType,
        discoveredCount: parsedFile.entries.length,
        summary,
      });

      if (summary.importedCount > 0 || summary.mergedCount > 0) {
        router.refresh();
      }
    } catch (error) {
      setImportError(
        error instanceof Error
          ? error.message
          : "Could not read the selected import file."
      );
    } finally {
      setIsImportingFeeds(false);
      setImportProgress(null);
    }
  }

  const importSummaryText = importSummary
    ? `Processed ${importSummary.summary.processedCount} unique valid URL${
        importSummary.summary.processedCount === 1 ? "" : "s"
      } from ${importSummary.sourceType} import (${importSummary.discoveredCount} discovered). Imported ${importSummary.summary.importedCount}, merged ${importSummary.summary.mergedCount} duplicate folder assignment${
        importSummary.summary.mergedCount === 1 ? "" : "s"
      }, kept ${
        importSummary.summary.duplicateCount - importSummary.summary.mergedCount
      } duplicate${importSummary.summary.duplicateCount - importSummary.summary.mergedCount === 1 ? "" : "s"} unchanged, and failed ${importSummary.summary.failedCount}.${
        importSummary.summary.skippedMultipleCount > 0
          ? ` ${importSummary.summary.skippedMultipleCount} entr${
              importSummary.summary.skippedMultipleCount === 1 ? "y" : "ies"
            } require manual feed selection.`
          : ""
      }`
    : null;

  const importButtonLabel = isImportingFeeds
    ? importProgress
      ? `Importing (${importProgress.processedCount}/${importProgress.totalCount})...`
      : "Importing..."
    : "Import feeds";

  return (
    <div className={styles.root}>
      <header className={styles.header}>
        <div className={styles.headerTopRow}>
          <h1>Account</h1>
          <Link href="/feeds" className={`${styles.linkButton} ${styles.compactButton}`}>
            <span className={styles.iconButtonContent}>
              {backIcon}
              <span>Return to feeds</span>
            </span>
          </Link>
        </div>
        <p className={styles.muted}>Signed in as {email}</p>
      </header>

      <div className={styles.settingsOptions}>
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
              {importButtonLabel}
            </button>
          </div>
          {isImportingFeeds && importProgress ? (
            <p className={styles.importProgress} role="status" aria-live="polite">
              Importing {importProgress.processedCount} of {importProgress.totalCount} feed URL
              {importProgress.totalCount === 1 ? "" : "s"}...
            </p>
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
          {importError ? <p className={styles.inlineMessage}>{importError}</p> : null}
          {importSummary && importSummaryText ? (
            <div className={styles.importSummary} role="status">
              <p>{importSummaryText}</p>
              <p className={styles.muted}>Source file: {importSummary.fileName}</p>
              {importSummary.summary.failedDetails.length > 0 ? (
                <ul className={styles.importFailureList}>
                  {importSummary.summary.failedDetails.map((detail) => (
                    <li key={detail}>{detail}</li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : null}
        </section>

        <section className={styles.panel}>
          <h2>Keyboard shortcuts</h2>
          <div
            ref={shortcutsWidthProbeRef}
            className={styles.shortcutsWidthProbe}
            aria-hidden="true"
          >
            <button type="button" className={styles.shortcutsToggle} tabIndex={-1}>
              <span className={styles.owlToggleCaret}>▸</span>
              {keyboardIcon}
              <span className={styles.shortcutsWidthProbeText}>Show keyboard shortcuts</span>
            </button>
            <div className={styles.shortcutsWidthProbeContent}>
              {SHORTCUT_GROUPS.map((group) => (
                <section key={`probe-${group.id}`} className={styles.shortcutsPanelGroup}>
                  <h3 className={styles.shortcutsWidthProbeText}>{group.label}</h3>
                  <div className={styles.shortcutsPanelRows}>
                    {group.shortcuts.map((shortcut) => (
                      <div key={`probe-${shortcut.id}`} className={styles.shortcutsPanelRow}>
                        <div className={styles.shortcutsPanelKeys}>
                          {shortcut.keys.map((key) => (
                            <kbd
                              key={`probe-${shortcut.id}-${key}`}
                              className={styles.shortcutsPanelKey}
                            >
                              {key}
                            </kbd>
                          ))}
                        </div>
                        <p
                          className={`${styles.shortcutsPanelDescription} ${styles.shortcutsWidthProbeText}`}
                        >
                          {shortcut.description}
                        </p>
                      </div>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          </div>
          <div
            ref={shortcutsControlsRef}
            className={styles.shortcutsControls}
            style={shortcutsControlsWidthPx ? { width: `${shortcutsControlsWidthPx}px` } : undefined}
          >
            <button
              type="button"
              className={styles.shortcutsToggle}
              aria-expanded={isShortcutsPanelExpanded}
              aria-controls={shortcutsPanelId}
              onClick={() => {
                setIsShortcutsPanelExpanded((previous) => !previous);
              }}
            >
              <span className={styles.owlToggleCaret}>
                {isShortcutsPanelExpanded ? "▾" : "▸"}
              </span>
              {keyboardIcon}
              <span>Show keyboard shortcuts</span>
            </button>
            <OwlOptionsShutter
              expanded={isShortcutsPanelExpanded}
              prefersReducedMotion={prefersReducedMotion}
              contentId={shortcutsPanelId}
            >
              <div className={styles.shortcutsPanelContent}>
                {SHORTCUT_GROUPS.map((group) => (
                  <section key={group.id} className={styles.shortcutsPanelGroup}>
                    <h3>{group.label}</h3>
                    <div className={styles.shortcutsPanelRows}>
                      {group.shortcuts.map((shortcut) => (
                        <div key={shortcut.id} className={styles.shortcutsPanelRow}>
                          <div className={styles.shortcutsPanelKeys}>
                            {shortcut.keys.map((key) => (
                              <kbd
                                key={`${shortcut.id}-${key}`}
                                className={styles.shortcutsPanelKey}
                              >
                                {key}
                              </kbd>
                            ))}
                          </div>
                          <p className={styles.shortcutsPanelDescription}>
                            {shortcut.description}
                          </p>
                        </div>
                      ))}
                    </div>
                  </section>
                ))}
              </div>
            </OwlOptionsShutter>
          </div>
        </section>

        <section className={styles.panel}>
          <h2>Hoot hoot</h2>
          <div ref={owlWidthProbeRef} className={styles.owlWidthProbe} aria-hidden="true">
            <button type="button" className={styles.owlToggle} tabIndex={-1}>
              <span className={styles.owlToggleCaret}>▸</span>
              <span className={styles.owlWidthProbeText}>
                Choose an owl to digest your feeds.
              </span>
            </button>
            <div className={styles.owlWidthProbeOptions}>
              {OWL_ART_OPTIONS.map((option) => (
                <label key={`probe-${option.ascii}`} className={styles.owlOption}>
                  <input type="radio" name="owl-ascii-probe" tabIndex={-1} />
                  <span className={styles.owlOptionAscii}>{option.ascii}</span>
                  <span className={`${styles.owlOptionText} ${styles.owlWidthProbeText}`}>
                    {option.name}:{" "}
                    {option.emphasizeDescription ? (
                      <em className={styles.owlOptionEmphasis}>{option.description}</em>
                    ) : (
                      option.description
                    )}
                  </span>
                </label>
              ))}
            </div>
          </div>
          <div
            ref={owlControlsRef}
            className={styles.owlPickerControls}
            style={owlControlsWidthPx ? { width: `${owlControlsWidthPx}px` } : undefined}
          >
            <button
              type="button"
              className={styles.owlToggle}
              aria-expanded={isOwlPanelExpanded}
              aria-controls={owlOptionsPanelId}
              onClick={() => {
                setIsOwlPanelExpanded((previous) => !previous);
              }}
            >
              <span className={styles.owlToggleCaret}>{isOwlPanelExpanded ? "▾" : "▸"}</span>
              <span>Choose an owl to digest your feeds.</span>
            </button>
            <OwlOptionsShutter
              expanded={isOwlPanelExpanded}
              prefersReducedMotion={prefersReducedMotion}
              contentId={owlOptionsPanelId}
            >
              <div
                className={styles.owlOptionList}
                role="radiogroup"
                aria-label="Choose an owl to digest your feeds."
              >
                {OWL_ART_OPTIONS.map((option) => {
                  const isSelected = draftOwlAscii === option.ascii;

                  return (
                    <label
                      key={option.ascii}
                      className={`${styles.owlOption} ${
                        isSelected ? styles.owlOptionSelected : ""
                      }`}
                    >
                      <input
                        type="radio"
                        name="owl-ascii"
                        value={option.ascii}
                        checked={isSelected}
                        onChange={() => {
                          setDraftOwlAscii(option.ascii);
                          setOwlSaveError(null);
                          setOwlSaveMessage(null);
                        }}
                      />
                      <span className={styles.owlOptionAscii}>{option.ascii}</span>
                      <span className={styles.owlOptionText}>
                        {option.name}:{" "}
                        {option.emphasizeDescription ? (
                          <em className={styles.owlOptionEmphasis}>{option.description}</em>
                        ) : (
                          option.description
                        )}
                      </span>
                    </label>
                  );
                })}
              </div>
              <div className={styles.inlineActions}>
                <button
                  type="button"
                  className={`${styles.linkButton} ${styles.compactButton}`}
                  onClick={() => {
                    void handleSaveOwl();
                  }}
                  disabled={isSavingOwl || draftOwlAscii === savedOwlAscii}
                >
                  {isSavingOwl ? "Saving..." : "Save owl"}
                </button>
              </div>
              {owlSaveMessage ? (
                <p className={styles.inlineMessage} role="status">
                  {owlSaveMessage}
                </p>
              ) : null}
              {owlSaveError ? <p className={styles.inlineMessage}>{owlSaveError}</p> : null}
            </OwlOptionsShutter>
          </div>
        </section>

        <section className={styles.panel}>
          <h2>Delete account</h2>
          {!showDeleteConfirm ? (
            <button
              type="button"
              className={`${styles.linkButton} ${styles.compactButton} ${styles.deleteAccountButton}`}
              onClick={() => setShowDeleteConfirm(true)}
            >
              <span className={styles.iconButtonContent}>
                {trashIcon}
                <span>Delete account...</span>
              </span>
            </button>
          ) : (
            <div className={styles.deleteConfirm}>
              <p>This will permanently delete your account and all data. This cannot be undone.</p>
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
                    {trashIcon}
                    <span>{isDeletingAccount ? "Deleting..." : "Yes, delete my account"}</span>
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
              {deleteError ? <p className={styles.inlineMessage}>{deleteError}</p> : null}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
