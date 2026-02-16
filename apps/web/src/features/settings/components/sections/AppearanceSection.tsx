"use client";

import { useEffect, useId, useRef, useState, type RefObject } from "react";
import { useRouter } from "next/navigation";
import { OwlOptionsShutter } from "@/features/settings/components/OwlOptionsShutter";
import { useMeasuredWidthPx } from "@/features/settings/components/useMeasuredWidthPx";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";
import { saveThemeMode } from "@/lib/client/settings";
import {
  applyThemeModeToDocument,
  coerceThemeMode,
  subscribeToSystemThemeModeChanges,
  type ThemeMode,
} from "@/lib/shared/theme-mode";
import styles from "../SettingsOverview.module.css";

interface AppearanceSectionProps {
  themeMode: ThemeMode;
  controlsRef: RefObject<HTMLDivElement | null>;
  isExpanded: boolean;
  setIsExpanded: (expanded: boolean) => void;
}

const THEME_MODE_OPTIONS: Array<{
  mode: ThemeMode;
  label: string;
}> = [
  {
    mode: "system",
    label: "Your system default",
  },
  {
    mode: "light",
    label: "Light",
  },
  {
    mode: "dark",
    label: "Dark",
  },
];

function applyThemeModeToAuthShell(mode: ThemeMode): void {
  if (typeof document === "undefined") {
    return;
  }

  const shell = document.querySelector<HTMLElement>("[data-theme-mode]");
  if (!shell) {
    return;
  }

  shell.dataset.themeMode = mode;
}

export function AppearanceSection({
  themeMode,
  controlsRef,
  isExpanded,
  setIsExpanded,
}: AppearanceSectionProps) {
  const router = useRouter();
  const themeModePanelId = useId();
  const prefersReducedMotion = usePrefersReducedMotion();

  const themeWidthProbeRef = useRef<HTMLDivElement | null>(null);
  const themeControlsWidthPx = useMeasuredWidthPx(themeWidthProbeRef);

  const savedThemeModeRef = useRef<ThemeMode>(themeMode);

  const [draftThemeMode, setDraftThemeMode] = useState<ThemeMode>(themeMode);
  const [savedThemeMode, setSavedThemeMode] = useState<ThemeMode>(themeMode);
  const [isSavingTheme, setIsSavingTheme] = useState(false);
  const [themeSaveMessage, setThemeSaveMessage] = useState<string | null>(null);
  const [themeSaveError, setThemeSaveError] = useState<string | null>(null);

  const isThemeDirty = draftThemeMode !== savedThemeMode;

  useEffect(() => {
    setDraftThemeMode(themeMode);
    setSavedThemeMode(themeMode);
    savedThemeModeRef.current = themeMode;
    applyThemeModeToAuthShell(themeMode);
  }, [themeMode]);

  useEffect(() => {
    savedThemeModeRef.current = savedThemeMode;
  }, [savedThemeMode]);

  useEffect(() => {
    return () => {
      // Previewed theme selections should not leak beyond the settings page.
      applyThemeModeToDocument(savedThemeModeRef.current);
      applyThemeModeToAuthShell(savedThemeModeRef.current);
    };
  }, []);

  useEffect(() => {
    if (draftThemeMode !== "system") {
      return;
    }

    applyThemeModeToDocument("system");
    return subscribeToSystemThemeModeChanges(() => {
      applyThemeModeToDocument("system");
    });
  }, [draftThemeMode]);

  function handleDraftThemeModeChange(nextThemeMode: ThemeMode) {
    if (isSavingTheme || nextThemeMode === draftThemeMode) {
      return;
    }

    setDraftThemeMode(nextThemeMode);
    setThemeSaveError(null);
    setThemeSaveMessage(null);
    applyThemeModeToDocument(nextThemeMode);
    applyThemeModeToAuthShell(nextThemeMode);
  }

  async function handleSaveThemeMode() {
    if (isSavingTheme || !isThemeDirty) {
      return;
    }

    setThemeSaveError(null);
    setThemeSaveMessage(null);
    setIsSavingTheme(true);

    const result = await saveThemeMode({ themeMode: draftThemeMode });
    if (result.networkError) {
      setThemeSaveError("Could not connect to the server.");
      setIsSavingTheme(false);
      return;
    }

    if (!result.ok) {
      setThemeSaveError(result.body?.error || "Could not save theme selection.");
      setIsSavingTheme(false);
      return;
    }

    const persistedThemeMode = coerceThemeMode(result.body?.themeMode ?? draftThemeMode);
    setDraftThemeMode(persistedThemeMode);
    setSavedThemeMode(persistedThemeMode);
    applyThemeModeToDocument(persistedThemeMode);
    applyThemeModeToAuthShell(persistedThemeMode);
    setThemeSaveMessage("Theme updated.");
    setIsSavingTheme(false);
    router.refresh();
  }

  return (
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
              <span
                className={`${styles.themeModeOptionLabel} ${styles.owlWidthProbeText}`}
              >
                {option.label}
              </span>
            </label>
          ))}
        </div>
      </div>
      <div
        ref={controlsRef}
        className={styles.owlPickerControls}
        style={themeControlsWidthPx ? { width: `${themeControlsWidthPx}px` } : undefined}
      >
        <button
          type="button"
          className={styles.owlToggle}
          aria-expanded={isExpanded}
          aria-controls={themeModePanelId}
          disabled={isSavingTheme}
          onClick={() => setIsExpanded(!isExpanded)}
        >
          <span className={styles.owlToggleCaret}>{isExpanded ? "▾" : "▸"}</span>
          <span>Choose your reading mode.</span>
        </button>
        <OwlOptionsShutter
          expanded={isExpanded}
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
                      handleDraftThemeModeChange(option.mode);
                    }}
                    disabled={isSavingTheme}
                  />
                  <span className={styles.themeModeOptionLabel}>{option.label}</span>
                </label>
              );
            })}
          </div>
          <div className={styles.inlineActions}>
            <button
              type="button"
              className={styles.saveButton}
              onClick={() => {
                void handleSaveThemeMode();
              }}
              disabled={isSavingTheme || !isThemeDirty}
            >
              Save
            </button>
          </div>
          {isSavingTheme ? (
            <p className={styles.inlineMessage} role="status">
              Saving theme...
            </p>
          ) : null}
          {themeSaveMessage ? (
            <p className={styles.inlineMessageSuccess} role="status">
              {themeSaveMessage}
            </p>
          ) : null}
          {themeSaveError ? (
            <p className={styles.inlineMessageError} role="alert" aria-live="assertive">
              {themeSaveError}
            </p>
          ) : null}
        </OwlOptionsShutter>
      </div>
    </section>
  );
}
