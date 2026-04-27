"use client";

/**
 * Shared keyboard shortcuts reference used by the feeds modal and settings panel.
 */

import { useId } from "react";
import { getShortcutKeyLabel, SHORTCUT_GROUPS } from "@/lib/shared/keyboard-shortcuts";
import styles from "./KeyboardShortcutsReference.module.css";

const PANE_DIAGRAM = [
  "+-----------+--------------+----------------+",
  "| Sidebar   | Article list | Reader         |",
  "| Feeds     | Headlines    | Full article   |",
  "+-----------+--------------+----------------+",
].join("\n");

const PANE_HELP = [
  {
    id: "sidebar",
    title: "Sidebar",
    description: "Choose a feed or folder.",
  },
  {
    id: "article-list",
    title: "Article list",
    description: "Choose an article.",
  },
  {
    id: "reader",
    title: "Reader",
    description: "Read and scroll the article.",
  },
] as const;

export function KeyboardShortcutsReference() {
  const paneGuideTitleId = useId();

  return (
    <div className={styles.reference}>
      <section className={styles.paneGuide} aria-labelledby={paneGuideTitleId}>
        <h3 id={paneGuideTitleId} className={styles.sectionTitle}>
          The three panes
        </h3>
        <pre className={styles.paneDiagram} aria-hidden="true">
          {PANE_DIAGRAM}
        </pre>
        <div className={styles.paneHelp}>
          {PANE_HELP.map((pane) => (
            <p key={pane.id} className={styles.paneHelpItem}>
              <strong>{pane.title}:</strong> {pane.description}
            </p>
          ))}
        </div>
      </section>

      <div className={styles.groups}>
        {SHORTCUT_GROUPS.map((group) => (
          <section key={group.id} className={styles.group}>
            <h3 className={styles.groupTitle}>{group.label}</h3>
            <div className={styles.rows}>
              {group.shortcuts.map((shortcut) => (
                <div key={shortcut.id} className={styles.row}>
                  <div className={styles.keys}>
                    {shortcut.keys.map((key) => (
                      <kbd key={`${shortcut.id}-${key}`} className={styles.key}>
                        {getShortcutKeyLabel(key)}
                      </kbd>
                    ))}
                  </div>
                  <p className={styles.rowDescription}>{shortcut.description}</p>
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
