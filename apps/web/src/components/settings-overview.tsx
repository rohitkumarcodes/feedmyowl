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
  summarizeImportRows,
  type FeedImportRowSummary,
} from "@/lib/feed-import-file";
import {
  IMPORT_RATE_LIMIT_MAX_RETRIES,
  buildChunkFallbackRows,
  buildImportFailureReport,
  isImportFailureRow,
  parseRetryAfterSeconds,
  reconcileChunkRowsByUrl,
} from "@/lib/feed-import-client";
import {
  FEED_IMPORT_CLIENT_CHUNK_SIZE,
  FEED_IMPORT_MAX_FILE_SIZE_BYTES,
  type FeedImportPreview,
  type FeedImportResponse,
  type FeedImportRowResult,
  type FeedImportSourceType,
} from "@/lib/feed-import-types";
import { OWL_ART_OPTIONS, coerceOwlAscii, type OwlAscii } from "@/lib/owl-brand";
import {
  applyThemeModeToDocument,
  coerceThemeMode,
  subscribeToSystemThemeModeChanges,
  type ThemeMode,
} from "@/lib/theme-mode";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";
import { getLandingPageUrl } from "@/lib/runtime-config";
import { parseResponseJson } from "@/lib/client/http";
import { SHORTCUT_GROUPS } from "./keyboard-shortcuts";
import styles from "./settings-overview.module.css";

interface SettingsOverviewProps {
  email: string;
  owlAscii: OwlAscii;
  themeMode: ThemeMode;
}

interface ImportRequestErrorBody {
  error?: string;
  code?: string;
}

interface SaveOwlResponseBody {
  error?: string;
  owlAscii?: string;
}

interface SaveThemeResponseBody {
  error?: string;
  themeMode?: string;
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
  failedRows: FeedImportRowResult[];
  warningRows: FeedImportRowResult[];
}

interface ImportProgress {
  processedCount: number;
  totalCount: number;
}

const THEME_MODE_OPTIONS: Array<{
  mode: ThemeMode;
  label: string;
  description: string;
}> = [
  {
    mode: "system",
    label: "System",
    description: "Matches your device appearance setting automatically.",
  },
  {
    mode: "light",
    label: "Light",
    description: "Bright workspace with high daylight contrast.",
  },
  {
    mode: "dark",
    label: "Dark",
    description: "Dimmer workspace for low-light reading sessions.",
  },
];

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
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    className={styles.buttonIcon}
    aria-hidden="true"
  >
    <path d="M12 0c-4.992 0-10 1.242-10 3.144 0 .406 3.556 18.488 3.633 18.887 1.135 1.313 3.735 1.969 6.334 1.969 2.601 0 5.199-.656 6.335-1.969.081-.404 3.698-18.468 3.698-18.882 0-2.473-7.338-3.149-10-3.149zm0 1.86c4.211 0 7.624.746 7.624 1.667 0 .92-3.413 1.667-7.624 1.667s-7.625-.746-7.625-1.667 3.415-1.667 7.625-1.667zm4.469 19.139c-.777.532-2.418 1.001-4.502 1.001-2.081 0-3.72-.467-4.498-.998l-.004-.021c-1.552-7.913-2.414-12.369-2.894-14.882 3.55 1.456 11.304 1.455 14.849-.002-.868 4.471-2.434 12.322-2.951 14.902z" />
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
export function SettingsOverview({ email, owlAscii, themeMode }: SettingsOverviewProps) {
  const router = useRouter();
  const themeModePanelId = useId();
  const owlOptionsPanelId = useId();
  const shortcutsPanelId = useId();
  const importFileInputRef = useRef<HTMLInputElement | null>(null);
  const themeControlsRef = useRef<HTMLDivElement | null>(null);
  const owlControlsRef = useRef<HTMLDivElement | null>(null);
  const shortcutsControlsRef = useRef<HTMLDivElement | null>(null);
  const themeWidthProbeRef = useRef<HTMLDivElement | null>(null);
  const owlWidthProbeRef = useRef<HTMLDivElement | null>(null);
  const shortcutsWidthProbeRef = useRef<HTMLDivElement | null>(null);
  const prefersReducedMotion = usePrefersReducedMotion();

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isImportingFeeds, setIsImportingFeeds] = useState(false);
  const [importProgress, setImportProgress] = useState<ImportProgress | null>(null);
  const [importRetryDelaySeconds, setImportRetryDelaySeconds] = useState<number | null>(null);
  const [importRetryCountdown, setImportRetryCountdown] = useState<number | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [importSummary, setImportSummary] = useState<ImportSummary | null>(null);
  const [importPreview, setImportPreview] = useState<FeedImportPreview | null>(null);
  const [, setIsLoadingPreview] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [draftOwlAscii, setDraftOwlAscii] = useState<OwlAscii>(owlAscii);
  const [savedOwlAscii, setSavedOwlAscii] = useState<OwlAscii>(owlAscii);
  const [isSavingOwl, setIsSavingOwl] = useState(false);
  const [owlSaveMessage, setOwlSaveMessage] = useState<string | null>(null);
  const [owlSaveError, setOwlSaveError] = useState<string | null>(null);
  const [draftThemeMode, setDraftThemeMode] = useState<ThemeMode>(themeMode);
  const [savedThemeMode, setSavedThemeMode] = useState<ThemeMode>(themeMode);
  const [isSavingTheme, setIsSavingTheme] = useState(false);
  const [themeSaveMessage, setThemeSaveMessage] = useState<string | null>(null);
  const [themeSaveError, setThemeSaveError] = useState<string | null>(null);
  const [isThemePanelExpanded, setIsThemePanelExpanded] = useState(false);
  const [isOwlPanelExpanded, setIsOwlPanelExpanded] = useState(false);
  const [isShortcutsPanelExpanded, setIsShortcutsPanelExpanded] = useState(false);
  const [themeControlsWidthPx, setThemeControlsWidthPx] = useState<number | null>(null);
  const [owlControlsWidthPx, setOwlControlsWidthPx] = useState<number | null>(null);
  const [shortcutsControlsWidthPx, setShortcutsControlsWidthPx] = useState<number | null>(
    null
  );

  const landingUrl = getLandingPageUrl();

  useEffect(() => {
    setDraftOwlAscii(owlAscii);
    setSavedOwlAscii(owlAscii);
  }, [owlAscii]);

  useEffect(() => {
    setDraftThemeMode(themeMode);
    setSavedThemeMode(themeMode);
  }, [themeMode]);

  useEffect(() => {
    if (draftThemeMode !== "system") {
      return;
    }

    applyThemeModeToDocument("system");
    return subscribeToSystemThemeModeChanges(() => {
      applyThemeModeToDocument("system");
    });
  }, [draftThemeMode]);

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

  useEffect(() => {
    if (!isThemePanelExpanded && !isOwlPanelExpanded && !isShortcutsPanelExpanded) {
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) {
        return;
      }

      const clickedInsideTheme = themeControlsRef.current?.contains(target) ?? false;
      const clickedInsideOwl = owlControlsRef.current?.contains(target) ?? false;
      const clickedInsideShortcuts =
        shortcutsControlsRef.current?.contains(target) ?? false;

      if (clickedInsideTheme || clickedInsideOwl || clickedInsideShortcuts) {
        return;
      }

      setIsThemePanelExpanded(false);
      setIsOwlPanelExpanded(false);
      setIsShortcutsPanelExpanded(false);
    };

    document.addEventListener("pointerdown", handlePointerDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
    };
  }, [isThemePanelExpanded, isOwlPanelExpanded, isShortcutsPanelExpanded]);

  useLayoutEffect(() => {
    const probe = themeWidthProbeRef.current;
    if (!probe) {
      return;
    }

    const measure = () => {
      const measuredWidth = Math.ceil(probe.getBoundingClientRect().width);
      if (measuredWidth <= 0) {
        return;
      }

      setThemeControlsWidthPx((previousWidth) =>
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

  async function handleExport(format: "opml" | "json") {
    if (isExporting) return;
    setExportError(null);
    setIsExporting(true);

    try {
      const response = await fetch(`/api/feeds/export?format=${format}`);
      if (!response.ok) {
        setExportError("Could not export feeds. Try again.");
        return;
      }

      const blob = await response.blob();
      const disposition = response.headers.get("Content-Disposition") ?? "";
      const filenameMatch = disposition.match(/filename="?([^";\s]+)"?/);
      const filename = filenameMatch?.[1] ?? `feedmyowl-export.${format === "json" ? "json" : "opml"}`;

      const downloadUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = downloadUrl;
      link.download = filename;
      document.body.append(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(downloadUrl);
    } catch {
      setExportError("Could not connect to the server.");
    } finally {
      setIsExporting(false);
    }
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

  async function handleThemeModeChange(nextThemeMode: ThemeMode) {
    if (isSavingTheme || nextThemeMode === draftThemeMode) {
      return;
    }

    const previousThemeMode = savedThemeMode;
    setDraftThemeMode(nextThemeMode);
    setThemeSaveError(null);
    setThemeSaveMessage(null);
    setIsSavingTheme(true);
    applyThemeModeToDocument(nextThemeMode);

    try {
      const response = await fetch("/api/settings/theme", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ themeMode: nextThemeMode }),
      });

      const body = await parseResponseJson<SaveThemeResponseBody>(response);

      if (!response.ok) {
        setDraftThemeMode(previousThemeMode);
        applyThemeModeToDocument(previousThemeMode);
        setThemeSaveError(body?.error || "Could not save theme selection.");
        return;
      }

      const persistedThemeMode = coerceThemeMode(body?.themeMode ?? nextThemeMode);
      setDraftThemeMode(persistedThemeMode);
      setSavedThemeMode(persistedThemeMode);
      applyThemeModeToDocument(persistedThemeMode);
      setThemeSaveMessage("Theme updated.");
      router.refresh();
    } catch {
      setDraftThemeMode(previousThemeMode);
      applyThemeModeToDocument(previousThemeMode);
      setThemeSaveError("Could not connect to the server.");
    } finally {
      setIsSavingTheme(false);
    }
  }

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
          `This file is too large (${(selectedFile.size / (1024 * 1024)).toFixed(1)} MB). The maximum allowed size is ${maxMb} MB.`
        );
        return;
      }

      const fileContents = await selectedFile.text();

      // Send to preview API for server-side validation
      const response = await fetch("/api/feeds/import-preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          file: {
            fileName: selectedFile.name,
            fileContents,
          },
        }),
      });

      if (!response.ok) {
        const errorBody = await response.json();
        setImportError(errorBody.error || "Could not generate import preview.");
        return;
      }

      const preview = await response.json();
      setImportPreview(preview);
    } catch (error) {
      setImportError(
        error instanceof Error
          ? error.message
          : "Could not read the selected import file."
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
      const chunks = chunkImportEntries(
        normalizedEntries,
        FEED_IMPORT_CLIENT_CHUNK_SIZE
      );
      const allRows: FeedImportRowResult[] = [];
      let processedCount = 0;

      setImportProgress({ processedCount: 0, totalCount: normalizedEntries.length });

      for (const chunk of chunks) {
        let chunkRows: FeedImportRowResult[] | null = null;
        let attempt = 0;

        while (attempt <= IMPORT_RATE_LIMIT_MAX_RETRIES) {
          try {
            const response = await fetch("/api/feeds/import", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                sourceType,
                entries: chunk,
                options: { skipMultiCandidate: true },
              }),
            });

            const body = await parseResponseJson<
              FeedImportResponse & ImportRequestErrorBody
            >(response);

            if (response.ok && body && Array.isArray(body.rows)) {
              chunkRows = reconcileChunkRowsByUrl({
                entries: chunk,
                rows: body.rows,
                fallbackMessage: "Could not import this row.",
              });
              break;
            }

            if (response.status === 429 && attempt < IMPORT_RATE_LIMIT_MAX_RETRIES) {
              const retryAfterSeconds = parseRetryAfterSeconds(
                response.headers.get("Retry-After")
              );
              setImportRetryDelaySeconds(retryAfterSeconds);
              await new Promise((resolve) => {
                window.setTimeout(resolve, retryAfterSeconds * 1_000);
              });
              setImportRetryDelaySeconds(null);
              attempt += 1;
              continue;
            }

            const requestErrorMessage = body?.error || "Could not import this chunk.";
            chunkRows = buildChunkFallbackRows(chunk, requestErrorMessage);
            break;
          } catch {
            chunkRows = buildChunkFallbackRows(
              chunk,
              "Could not connect to the server."
            );
            break;
          }
        }

        allRows.push(
          ...(chunkRows || buildChunkFallbackRows(chunk, "Could not import this chunk."))
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
        (row) => Array.isArray(row.warnings) && row.warnings.length > 0
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
          : "Could not read the selected import file."
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
    const baseFileName = importSummary.fileName.replace(/\.[^/.]+$/, "") || "feeds";
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
      }, kept ${
        importSummary.summary.duplicateCount - importSummary.summary.mergedCount
      } duplicate${importSummary.summary.duplicateCount - importSummary.summary.mergedCount === 1 ? "" : "s"} unchanged, and failed ${importSummary.summary.failedCount}.${
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

  const importButtonLabel = isImportingFeeds
    ? importProgress
      ? `Importing (${importProgress.processedCount}/${importProgress.totalCount})...`
      : "Importing..."
    : "Import feeds";

  return (
    <div className={styles.root}>
      <header className={styles.header}>
        <div className={styles.headerTopRow}>
          <h1>Settings</h1>
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
          <h2>Appearance</h2>
          <div ref={themeWidthProbeRef} className={styles.owlWidthProbe} aria-hidden="true">
            <button type="button" className={styles.owlToggle} tabIndex={-1}>
              <span className={styles.owlToggleCaret}>▸</span>
              <span className={styles.owlWidthProbeText}>Choose your reading mode.</span>
            </button>
            <div className={styles.owlWidthProbeOptions}>
              {THEME_MODE_OPTIONS.map((option) => (
                <label key={`probe-theme-${option.mode}`} className={styles.themeModeOption}>
                  <input type="radio" name="theme-mode-probe" tabIndex={-1} />
                  <span className={styles.themeModeOptionLabel}>{option.label}</span>
                  <span
                    className={`${styles.themeModeOptionDescription} ${styles.owlWidthProbeText}`}
                  >
                    {option.description}
                  </span>
                </label>
              ))}
            </div>
          </div>
          <div
            ref={themeControlsRef}
            className={styles.owlPickerControls}
            style={themeControlsWidthPx ? { width: `${themeControlsWidthPx}px` } : undefined}
          >
            <button
              type="button"
              className={styles.owlToggle}
              aria-expanded={isThemePanelExpanded}
              aria-controls={themeModePanelId}
              disabled={isSavingTheme}
              onClick={() => {
                setIsThemePanelExpanded((previous) => !previous);
              }}
            >
              <span className={styles.owlToggleCaret}>{isThemePanelExpanded ? "▾" : "▸"}</span>
              <span>Choose your reading mode.</span>
            </button>
            <OwlOptionsShutter
              expanded={isThemePanelExpanded}
              prefersReducedMotion={prefersReducedMotion}
              contentId={themeModePanelId}
            >
              <div
                className={styles.themeModeGroup}
                role="radiogroup"
                aria-label="Choose appearance mode"
              >
                {THEME_MODE_OPTIONS.map((option) => {
                  const isSelected = draftThemeMode === option.mode;

                  return (
                    <label
                      key={option.mode}
                      className={`${styles.themeModeOption} ${
                        isSelected ? styles.themeModeOptionSelected : ""
                      }`}
                    >
                      <input
                        type="radio"
                        name="theme-mode"
                        value={option.mode}
                        checked={isSelected}
                        onChange={() => {
                          void handleThemeModeChange(option.mode);
                        }}
                        disabled={isSavingTheme}
                      />
                      <span className={styles.themeModeOptionLabel}>{option.label}</span>
                      <span className={styles.themeModeOptionDescription}>
                        {option.description}
                      </span>
                    </label>
                  );
                })}
              </div>
              {isSavingTheme ? (
                <p className={styles.inlineMessage} role="status">
                  Saving theme...
                </p>
              ) : null}
              {themeSaveMessage ? (
                <p className={styles.inlineMessage} role="status">
                  {themeSaveMessage}
                </p>
              ) : null}
              {themeSaveError ? (
                <p className={styles.inlineMessage}>{themeSaveError}</p>
              ) : null}
            </OwlOptionsShutter>
          </div>
        </section>

        <section className={styles.panel}>
          <h2>Feeds</h2>
          <p className={styles.muted}>
            Export your library or import feeds from OPML/XML or FeedMyOwl JSON v2.
          </p>
          <div className={styles.inlineActions}>
            <button
              type="button"
              className={styles.linkButton}
              onClick={() => { void handleExport("opml"); }}
              disabled={isExporting}
            >
              {isExporting ? "Exporting..." : "Export OPML"}
            </button>
            <button
              type="button"
              className={styles.linkButton}
              onClick={() => { void handleExport("json"); }}
              disabled={isExporting}
            >
              {isExporting ? "Exporting..." : "Export JSON"}
            </button>
            <button
              type="button"
              className={styles.linkButton}
              onClick={() => importFileInputRef.current?.click()}
              disabled={isImportingFeeds || importPreview !== null}
            >
              {importButtonLabel}
            </button>
          </div>
          {exportError ? <p className={styles.inlineMessage}>{exportError}</p> : null}
          {importPreview ? (
            <div className={styles.importSummary} role="status">
              <p>
                Found {importPreview.totalCount} feed
                {importPreview.totalCount === 1 ? "" : "s"}
                {importPreview.folderNames.length > 0
                  ? ` in ${importPreview.folderNames.length} folder${importPreview.folderNames.length === 1 ? "" : "s"}`
                  : ""}
                . Detected format: {importPreview.sourceType}.
              </p>
              <p className={styles.muted}>Source file: {importPreview.fileName}</p>
              <div className={styles.inlineActions}>
                <button
                  type="button"
                  className={styles.linkButton}
                  onClick={() => { void handleConfirmImport(); }}
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
                Importing {importProgress.processedCount} of {importProgress.totalCount} feed URL
                {importProgress.totalCount === 1 ? "" : "s"}...
              </p>
              {importRetryCountdown !== null ? (
                <p className={styles.importProgress} role="status" aria-live="polite">
                  Rate limit reached. Retrying in {importRetryCountdown} second
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
          {importError ? <p className={styles.inlineMessage}>{importError}</p> : null}
          {importSummary && importSummaryText ? (
            <div className={styles.importSummary} role="status">
              <p>{importSummaryText}</p>
              <p className={styles.muted}>Source file: {importSummary.fileName}</p>
              {importSummary.failedRows.length > 0 ||
              importSummary.warningRows.length > 0 ? (
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
