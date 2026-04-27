"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import styles from "../SettingsOverview.module.css";

type BackupCadence = "off" | "weekly" | "monthly" | "quarterly";

interface BackupReminderState {
  cadence: BackupCadence;
  lastCompletedAt: string | null;
}

const STORAGE_KEY = "feedmyowl.backup_reminder.v1";
const CADENCE_OPTIONS: Array<{
  value: BackupCadence;
  label: string;
  days: number | null;
}> = [
  { value: "off", label: "Off", days: null },
  { value: "weekly", label: "Weekly", days: 7 },
  { value: "monthly", label: "Monthly", days: 30 },
  { value: "quarterly", label: "Quarterly", days: 90 },
];

const DEFAULT_STATE: BackupReminderState = {
  cadence: "monthly",
  lastCompletedAt: null,
};

function readBackupReminderState(): BackupReminderState {
  if (typeof window === "undefined") {
    return DEFAULT_STATE;
  }

  const rawValue = window.localStorage.getItem(STORAGE_KEY);
  if (!rawValue) {
    return DEFAULT_STATE;
  }

  try {
    const parsed = JSON.parse(rawValue) as Partial<BackupReminderState>;
    const parsedCadence = parsed.cadence;
    const cadence: BackupCadence =
      parsedCadence && CADENCE_OPTIONS.some((option) => option.value === parsedCadence)
        ? parsedCadence
        : DEFAULT_STATE.cadence;

    return {
      cadence,
      lastCompletedAt:
        typeof parsed.lastCompletedAt === "string" ? parsed.lastCompletedAt : null,
    };
  } catch {
    return DEFAULT_STATE;
  }
}

function formatDate(value: Date): string {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
  }).format(value);
}

function getNextBackupText(state: BackupReminderState): string {
  const option = CADENCE_OPTIONS.find((candidate) => candidate.value === state.cadence);
  if (!option || option.days === null) {
    return "Backup reminders are off.";
  }

  const baseDate = state.lastCompletedAt ? new Date(state.lastCompletedAt) : new Date();
  if (Number.isNaN(baseDate.valueOf())) {
    return "Next backup date will be set after your next download.";
  }

  const nextDate = new Date(baseDate);
  nextDate.setDate(nextDate.getDate() + option.days);

  return `Next backup due ${formatDate(nextDate)}.`;
}

export function BackupRestoreSection() {
  const [state, setState] = useState<BackupReminderState>(DEFAULT_STATE);
  const [hasLoadedReminder, setHasLoadedReminder] = useState(false);
  const [isExportingJson, setIsExportingJson] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    setState(readBackupReminderState());
    setHasLoadedReminder(true);
  }, []);

  useEffect(() => {
    if (!hasLoadedReminder) {
      return;
    }

    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [hasLoadedReminder, state]);

  const nextBackupText = useMemo(() => getNextBackupText(state), [state]);

  async function downloadJsonBackup() {
    if (isExportingJson) {
      return;
    }

    setIsExportingJson(true);
    setMessage("");

    try {
      const response = await fetch("/api/feeds/export?format=json");
      if (!response.ok) {
        setMessage("Could not download JSON backup.");
        return;
      }

      const blob = await response.blob();
      const disposition = response.headers.get("Content-Disposition") ?? "";
      const filenameMatch = disposition.match(/filename=\"?([^\";\\s]+)\"?/);
      const filename = filenameMatch?.[1] ?? "feedmyowl-export.json";
      const downloadUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = downloadUrl;
      link.download = filename;
      document.body.append(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(downloadUrl);

      const nowIso = new Date().toISOString();
      setState((previous) => ({ ...previous, lastCompletedAt: nowIso }));
      setMessage("JSON backup downloaded.");
    } catch {
      setMessage("Could not connect to the server.");
    } finally {
      setIsExportingJson(false);
    }
  }

  return (
    <section className={styles.panel}>
      <h2>Backup and restore</h2>
      <div className={styles.backupControls}>
        <div className={styles.backupCadenceOptions} aria-label="Backup reminder">
          {CADENCE_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              className={`${styles.backupCadenceOption} ${
                state.cadence === option.value ? styles.backupCadenceOptionSelected : ""
              }`}
              onClick={() =>
                setState((previous) => ({ ...previous, cadence: option.value }))
              }
            >
              {option.label}
            </button>
          ))}
        </div>
        <p className={styles.muted}>{nextBackupText}</p>
        <div className={styles.inlineActions}>
          <button
            type="button"
            className={styles.linkButton}
            onClick={() => {
              void downloadJsonBackup();
            }}
            disabled={isExportingJson}
          >
            {isExportingJson ? "Downloading..." : "Download JSON backup"}
          </button>
          <button
            type="button"
            className={styles.linkButton}
            onClick={() =>
              setState((previous) => ({
                ...previous,
                lastCompletedAt: new Date().toISOString(),
              }))
            }
          >
            Mark backup done
          </button>
          <Link href="#import-feeds" className={styles.linkButton}>
            Restore from backup
          </Link>
        </div>
        {message ? <p className={styles.inlineMessage}>{message}</p> : null}
      </div>
    </section>
  );
}
