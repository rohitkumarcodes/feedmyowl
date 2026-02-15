"use client";

import { useId, useRef, type RefObject } from "react";
import { OwlOptionsShutter } from "@/features/settings/components/OwlOptionsShutter";
import { KeyboardIcon } from "@/features/settings/components/icons";
import { useMeasuredWidthPx } from "@/features/settings/components/useMeasuredWidthPx";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";
import { SHORTCUT_GROUPS } from "@/lib/shared/keyboard-shortcuts";
import styles from "../SettingsOverview.module.css";

interface KeyboardShortcutsSectionProps {
  controlsRef: RefObject<HTMLDivElement | null>;
  isExpanded: boolean;
  setIsExpanded: (expanded: boolean) => void;
}

export function KeyboardShortcutsSection({
  controlsRef,
  isExpanded,
  setIsExpanded,
}: KeyboardShortcutsSectionProps) {
  const shortcutsPanelId = useId();
  const prefersReducedMotion = usePrefersReducedMotion();

  const shortcutsWidthProbeRef = useRef<HTMLDivElement | null>(null);
  const shortcutsControlsWidthPx = useMeasuredWidthPx(shortcutsWidthProbeRef);

  return (
    <section className={styles.panel}>
      <h2>Keyboard shortcuts</h2>
      <div
        ref={shortcutsWidthProbeRef}
        className={styles.shortcutsWidthProbe}
        aria-hidden="true"
      >
        <button type="button" className={styles.shortcutsToggle} tabIndex={-1}>
          <span className={styles.owlToggleCaret}>▸</span>
          <KeyboardIcon className={styles.buttonIcon} />
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
        ref={controlsRef}
        className={styles.shortcutsControls}
        style={
          shortcutsControlsWidthPx
            ? { width: `${shortcutsControlsWidthPx}px` }
            : undefined
        }
      >
        <button
          type="button"
          className={styles.shortcutsToggle}
          aria-expanded={isExpanded}
          aria-controls={shortcutsPanelId}
          onClick={() => {
            setIsExpanded(!isExpanded);
          }}
        >
          <span className={styles.owlToggleCaret}>{isExpanded ? "▾" : "▸"}</span>
          <KeyboardIcon className={styles.buttonIcon} />
          <span>Show keyboard shortcuts</span>
        </button>
        <OwlOptionsShutter
          expanded={isExpanded}
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
  );
}
