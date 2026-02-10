"use client";

import {
  useEffect,
  useId,
  useRef,
  useState,
  type ChangeEvent,
  type ReactNode,
  type TransitionEvent,
} from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { normalizeFeedUrl } from "@/lib/feed-url";
import { OWL_ART_OPTIONS, coerceOwlAscii, type OwlAscii } from "@/lib/owl-brand";
import styles from "./settings-overview.module.css";

interface SettingsOverviewProps {
  email: string;
  owlAscii: OwlAscii;
}

interface ImportResponseBody {
  error?: string;
  duplicate?: boolean;
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

/**
 * Renders minimal account settings for the reading MVP.
 */
export function SettingsOverview({ email, owlAscii }: SettingsOverviewProps) {
  const router = useRouter();
  const owlOptionsPanelId = useId();
  const importFileInputRef = useRef<HTMLInputElement | null>(null);
  const prefersReducedMotion = usePrefersReducedMotion();

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isImportingFeeds, setIsImportingFeeds] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [importSummary, setImportSummary] = useState<ImportSummary | null>(null);
  const [draftOwlAscii, setDraftOwlAscii] = useState<OwlAscii>(owlAscii);
  const [savedOwlAscii, setSavedOwlAscii] = useState<OwlAscii>(owlAscii);
  const [isSavingOwl, setIsSavingOwl] = useState(false);
  const [owlSaveMessage, setOwlSaveMessage] = useState<string | null>(null);
  const [owlSaveError, setOwlSaveError] = useState<string | null>(null);
  const [isOwlPanelExpanded, setIsOwlPanelExpanded] = useState(false);

  const landingUrl =
    process.env.NEXT_PUBLIC_LANDING_PAGE_URL || "https://feedmyowl.com";

  useEffect(() => {
    setDraftOwlAscii(owlAscii);
    setSavedOwlAscii(owlAscii);
  }, [owlAscii]);

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
          <span>Pick an owl to digest your feeds.</span>
        </button>
        <OwlOptionsShutter
          expanded={isOwlPanelExpanded}
          prefersReducedMotion={prefersReducedMotion}
          contentId={owlOptionsPanelId}
        >
          <div
            className={styles.owlOptionList}
            role="radiogroup"
            aria-label="Pick an owl to digest your feeds."
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
      </section>

      <section className={styles.panel}>
        <h2>Delete account</h2>
        {!showDeleteConfirm ? (
          <button
            type="button"
            className={`${styles.linkButton} ${styles.compactButton}`}
            onClick={() => setShowDeleteConfirm(true)}
          >
            <span className={styles.iconButtonContent}>
              {trashIcon}
              <span>Delete my account</span>
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
  );
}
