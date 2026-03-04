"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { DeleteAccountSection } from "@/features/settings/components/sections/DeleteAccountSection";
import { ExportSection } from "@/features/settings/components/sections/ExportSection";
import { ImportSection } from "@/features/settings/components/sections/ImportSection";
import { KeyboardShortcutsSection } from "@/features/settings/components/sections/KeyboardShortcutsSection";
import { ReadingModeSection } from "@/features/settings/components/sections/ReadingModeSection";
import { BackIcon } from "@/features/settings/components/icons";
import type { ReadingMode } from "@/lib/shared/reading-mode";
import styles from "./SettingsOverview.module.css";

interface SettingsOverviewProps {
  email: string;
  readingMode: ReadingMode;
}

/**
 * Renders minimal account settings for the reading MVP.
 */
export function SettingsOverview({
  email,
  readingMode,
}: SettingsOverviewProps) {
  const readingModeControlsRef = useRef<HTMLDivElement | null>(null);
  const shortcutsControlsRef = useRef<HTMLDivElement | null>(null);

  const [isReadingModePanelExpanded, setIsReadingModePanelExpanded] = useState(false);
  const [isShortcutsPanelExpanded, setIsShortcutsPanelExpanded] = useState(false);

  useEffect(() => {
    if (!isReadingModePanelExpanded && !isShortcutsPanelExpanded) {
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) {
        return;
      }

      const clickedInsideReadingMode =
        readingModeControlsRef.current?.contains(target) ?? false;
      const clickedInsideShortcuts =
        shortcutsControlsRef.current?.contains(target) ?? false;

      if (clickedInsideReadingMode || clickedInsideShortcuts) {
        return;
      }

      setIsReadingModePanelExpanded(false);
      setIsShortcutsPanelExpanded(false);
    };

    document.addEventListener("pointerdown", handlePointerDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
    };
  }, [isReadingModePanelExpanded, isShortcutsPanelExpanded]);

  return (
    <div className={styles.root}>
      <header className={styles.header}>
        <div className={styles.headerTopRow}>
          <h1>Settings</h1>
          <Link href="/feeds" className={`${styles.linkButton} ${styles.compactButton}`}>
            <span className={styles.iconButtonContent}>
              <BackIcon className={styles.buttonIcon} />
              <span>Return to feeds</span>
            </span>
          </Link>
        </div>
        <p className={styles.muted}>Signed in as {email}</p>
      </header>

      <div className={styles.settingsOptions}>
        <ReadingModeSection
          readingMode={readingMode}
          controlsRef={readingModeControlsRef}
          isExpanded={isReadingModePanelExpanded}
          setIsExpanded={setIsReadingModePanelExpanded}
        />
        <ImportSection />
        <ExportSection />
        <KeyboardShortcutsSection
          controlsRef={shortcutsControlsRef}
          isExpanded={isShortcutsPanelExpanded}
          setIsExpanded={setIsShortcutsPanelExpanded}
        />
        <DeleteAccountSection />
      </div>
    </div>
  );
}
