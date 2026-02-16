"use client";

import { useId, useRef, useState, type RefObject } from "react";
import { useRouter } from "next/navigation";
import { OwlOptionsShutter } from "@/features/settings/components/OwlOptionsShutter";
import { useMeasuredWidthPx } from "@/features/settings/components/useMeasuredWidthPx";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";
import { saveReadingMode } from "@/lib/client/settings";
import { coerceReadingMode, type ReadingMode } from "@/lib/shared/reading-mode";
import styles from "../SettingsOverview.module.css";

interface ReadingModeSectionProps {
  readingMode: ReadingMode;
  controlsRef: RefObject<HTMLDivElement | null>;
  isExpanded: boolean;
  setIsExpanded: (expanded: boolean) => void;
}

/**
 * Each option in the reading mode picker.
 * "reader" = calm, archival.  "checker" = traditional RSS with unread tracking.
 */
const READING_MODE_OPTIONS: Array<{
  mode: ReadingMode;
  label: string;
  description: string;
}> = [
  {
    mode: "reader",
    label: "Reader",
    description:
      "Read calmly. No unread counts, no badges, no urgency. Just you and the content.",
  },
  {
    mode: "checker",
    label: "Updates Checker",
    description:
      "Stay current. Unread counts, badges, and tools to track what's new.",
  },
];

export function ReadingModeSection({
  readingMode,
  controlsRef,
  isExpanded,
  setIsExpanded,
}: ReadingModeSectionProps) {
  const router = useRouter();
  const panelId = useId();
  const prefersReducedMotion = usePrefersReducedMotion();

  const widthProbeRef = useRef<HTMLDivElement | null>(null);
  const controlsWidthPx = useMeasuredWidthPx(widthProbeRef);

  const [draftReadingMode, setDraftReadingMode] = useState<ReadingMode>(readingMode);
  const [savedReadingMode, setSavedReadingMode] = useState<ReadingMode>(readingMode);
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  const isDirty = draftReadingMode !== savedReadingMode;

  function handleDraftChange(nextMode: ReadingMode) {
    if (isSaving || nextMode === draftReadingMode) {
      return;
    }

    setDraftReadingMode(nextMode);
    setSaveError(null);
    setSaveMessage(null);
  }

  async function handleSave() {
    if (isSaving || !isDirty) {
      return;
    }

    setSaveError(null);
    setSaveMessage(null);
    setIsSaving(true);

    const result = await saveReadingMode({ readingMode: draftReadingMode });
    if (result.networkError) {
      setSaveError("Could not connect to the server.");
      setIsSaving(false);
      return;
    }

    if (!result.ok) {
      setSaveError(result.body?.error || "Could not save reading mode.");
      setIsSaving(false);
      return;
    }

    const persisted = coerceReadingMode(result.body?.readingMode ?? draftReadingMode);
    setDraftReadingMode(persisted);
    setSavedReadingMode(persisted);
    setSaveMessage("Reading mode updated.");
    setIsSaving(false);
    router.refresh();
  }

  return (
    <section className={styles.panel}>
      <h2>Reading mode</h2>

      {/* Hidden probe measures the widest content so the panel doesn't jump */}
      <div ref={widthProbeRef} className={styles.owlWidthProbe} aria-hidden="true">
        <button type="button" className={styles.owlToggle} tabIndex={-1}>
          <span className={styles.owlToggleCaret}>▸</span>
          <span className={styles.owlWidthProbeText}>Choose how you read your feeds.</span>
        </button>
        <div className={styles.owlWidthProbeOptions}>
          {READING_MODE_OPTIONS.map((option) => (
            <label key={`probe-rm-${option.mode}`} className={styles.themeModeOption}>
              <input type="radio" name="reading-mode-probe" tabIndex={-1} />
              <span className={`${styles.themeModeOptionLabel} ${styles.owlWidthProbeText}`}>
                {option.label}
              </span>
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
        ref={controlsRef}
        className={styles.owlPickerControls}
        style={controlsWidthPx ? { width: `${controlsWidthPx}px` } : undefined}
      >
        <button
          type="button"
          className={styles.owlToggle}
          aria-expanded={isExpanded}
          aria-controls={panelId}
          disabled={isSaving}
          onClick={() => setIsExpanded(!isExpanded)}
        >
          <span className={styles.owlToggleCaret}>{isExpanded ? "▾" : "▸"}</span>
          <span>Choose how you read your feeds.</span>
        </button>

        <OwlOptionsShutter
          expanded={isExpanded}
          prefersReducedMotion={prefersReducedMotion}
          contentId={panelId}
        >
          <div
            className={styles.themeModeGroup}
            role="radiogroup"
            aria-label="Choose reading mode"
          >
            {READING_MODE_OPTIONS.map((option) => {
              const isSelected = draftReadingMode === option.mode;

              return (
                <label
                  key={option.mode}
                  className={`${styles.themeModeOption} ${
                    isSelected ? styles.themeModeOptionSelected : ""
                  }`}
                >
                  <input
                    type="radio"
                    name="reading-mode"
                    value={option.mode}
                    checked={isSelected}
                    onChange={() => {
                      handleDraftChange(option.mode);
                    }}
                    disabled={isSaving}
                  />
                  <span className={styles.themeModeOptionLabel}>{option.label}</span>
                  <span className={styles.themeModeOptionDescription}>
                    {option.description}
                  </span>
                </label>
              );
            })}
          </div>
          <div className={styles.inlineActions}>
            <button
              type="button"
              className={styles.saveButton}
              onClick={() => {
                void handleSave();
              }}
              disabled={isSaving || !isDirty}
            >
              Save
            </button>
          </div>
          {isSaving ? (
            <p className={styles.inlineMessage} role="status">
              Saving reading mode...
            </p>
          ) : null}
          {saveMessage ? (
            <p className={styles.inlineMessageSuccess} role="status">
              {saveMessage}
            </p>
          ) : null}
          {saveError ? (
            <p className={styles.inlineMessageError} role="alert" aria-live="assertive">
              {saveError}
            </p>
          ) : null}
        </OwlOptionsShutter>
      </div>
    </section>
  );
}
