"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ExportSection } from "@/features/settings/components/sections/ExportSection";
import { ImportSection } from "@/features/settings/components/sections/ImportSection";
import { BackupRestoreSection } from "@/features/settings/components/sections/BackupRestoreSection";
import { KeyboardShortcutsSection } from "@/features/settings/components/sections/KeyboardShortcutsSection";
import { BackIcon } from "@/features/settings/components/icons";
import styles from "./SettingsOverview.module.css";

interface SettingsOverviewProps {
  email?: string;
}

/**
 * Renders minimal account settings for the reading MVP.
 */
export function SettingsOverview({ email }: SettingsOverviewProps) {
  const shortcutsControlsRef = useRef<HTMLDivElement | null>(null);

  const [isShortcutsPanelExpanded, setIsShortcutsPanelExpanded] = useState(false);

  useEffect(() => {
    if (!isShortcutsPanelExpanded) {
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) {
        return;
      }

      const clickedInsideShortcuts =
        shortcutsControlsRef.current?.contains(target) ?? false;

      if (clickedInsideShortcuts) {
        return;
      }

      setIsShortcutsPanelExpanded(false);
    };

    document.addEventListener("pointerdown", handlePointerDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
    };
  }, [isShortcutsPanelExpanded]);

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
        {email ? <p className={styles.muted}>Signed in as {email}</p> : null}
      </header>

      <div className={styles.settingsOptions}>
        <ImportSection />
        <ExportSection />
        <BackupRestoreSection />
        <KeyboardShortcutsSection
          controlsRef={shortcutsControlsRef}
          isExpanded={isShortcutsPanelExpanded}
          setIsExpanded={setIsShortcutsPanelExpanded}
        />
      </div>
    </div>
  );
}
