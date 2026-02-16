"use client";

import { useState } from "react";
import styles from "../SettingsOverview.module.css";

interface ExportFormat {
  format: "opml" | "json";
  label: string;
  sublabel: string;
}

const EXPORT_FORMAT_OPTIONS: ExportFormat[] = [
  { format: "opml", label: "OPML", sublabel: "Works with most feed readers" },
  { format: "json", label: "JSON", sublabel: "Full backup including folders" },
];

export function ExportSection() {
  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

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
      const filenameMatch = disposition.match(/filename=\"?([^\";\\s]+)\"?/);
      const filename =
        filenameMatch?.[1] ?? `feedmyowl-export.${format === "json" ? "json" : "opml"}`;

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

  return (
    <section className={styles.panel}>
      <h2>Export feeds</h2>
      <p className={styles.feedsSectionDescription}>
        Download a backup of your subscriptions.
      </p>
      <div className={styles.feedsExportSection}>
        <div className={styles.exportFormatSelector} aria-label="Export format">
          {EXPORT_FORMAT_OPTIONS.map((option) => (
            <button
              key={option.format}
              type="button"
              className={styles.exportFormatOption}
              onClick={() => {
                void handleExport(option.format);
              }}
              disabled={isExporting}
            >
              <span className={styles.exportFormatLabel}>{option.label}</span>
              <span className={styles.exportFormatSublabel}>{option.sublabel}</span>
            </button>
          ))}
        </div>
      </div>
      {exportError ? (
        <p className={styles.inlineMessageError} role="alert" aria-live="assertive">
          {exportError}
        </p>
      ) : null}
    </section>
  );
}
