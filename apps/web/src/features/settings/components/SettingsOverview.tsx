"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AppearanceSection } from "@/features/settings/components/sections/AppearanceSection";
import { DeleteAccountSection } from "@/features/settings/components/sections/DeleteAccountSection";
import { ExportSection } from "@/features/settings/components/sections/ExportSection";
import { ImportSection } from "@/features/settings/components/sections/ImportSection";
import { KeyboardShortcutsSection } from "@/features/settings/components/sections/KeyboardShortcutsSection";
import { OwlSection } from "@/features/settings/components/sections/OwlSection";
import { ReadingModeSection } from "@/features/settings/components/sections/ReadingModeSection";
import { BackIcon } from "@/features/settings/components/icons";
import type { OwlAscii } from "@/lib/shared/owl-brand";
import type { ReadingMode } from "@/lib/shared/reading-mode";
import type { ThemeMode } from "@/lib/shared/theme-mode";
import styles from "./SettingsOverview.module.css";

interface SettingsOverviewProps {
  email: string;
  owlAscii: OwlAscii;
  themeMode: ThemeMode;
  readingMode: ReadingMode;
}

/**
 * Renders minimal account settings for the reading MVP.
 */
export function SettingsOverview({ email, owlAscii, themeMode, readingMode }: SettingsOverviewProps) {
  const themeControlsRef = useRef<HTMLDivElement | null>(null);
  const readingModeControlsRef = useRef<HTMLDivElement | null>(null);
  const owlControlsRef = useRef<HTMLDivElement | null>(null);
  const shortcutsControlsRef = useRef<HTMLDivElement | null>(null);

  const [isThemePanelExpanded, setIsThemePanelExpanded] = useState(false);
  const [isReadingModePanelExpanded, setIsReadingModePanelExpanded] = useState(false);
  const [isOwlPanelExpanded, setIsOwlPanelExpanded] = useState(false);
  const [isShortcutsPanelExpanded, setIsShortcutsPanelExpanded] = useState(false);

  useEffect(() => {
    if (
      !isThemePanelExpanded &&
      !isReadingModePanelExpanded &&
      !isOwlPanelExpanded &&
      !isShortcutsPanelExpanded
    ) {
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) {
        return;
      }

      const clickedInsideTheme = themeControlsRef.current?.contains(target) ?? false;
      const clickedInsideReadingMode =
        readingModeControlsRef.current?.contains(target) ?? false;
      const clickedInsideOwl = owlControlsRef.current?.contains(target) ?? false;
      const clickedInsideShortcuts =
        shortcutsControlsRef.current?.contains(target) ?? false;

      if (
        clickedInsideTheme ||
        clickedInsideReadingMode ||
        clickedInsideOwl ||
        clickedInsideShortcuts
      ) {
        return;
      }

      setIsThemePanelExpanded(false);
      setIsReadingModePanelExpanded(false);
      setIsOwlPanelExpanded(false);
      setIsShortcutsPanelExpanded(false);
    };

    document.addEventListener("pointerdown", handlePointerDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
    };
  }, [isThemePanelExpanded, isReadingModePanelExpanded, isOwlPanelExpanded, isShortcutsPanelExpanded]);

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
        <AppearanceSection
          themeMode={themeMode}
          controlsRef={themeControlsRef}
          isExpanded={isThemePanelExpanded}
          setIsExpanded={setIsThemePanelExpanded}
        />
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
        <OwlSection
          owlAscii={owlAscii}
          controlsRef={owlControlsRef}
          isExpanded={isOwlPanelExpanded}
          setIsExpanded={setIsOwlPanelExpanded}
        />
        <DeleteAccountSection />
      </div>
    </div>
  );
}
