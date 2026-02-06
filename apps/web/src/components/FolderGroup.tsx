/**
 * Expandable sidebar section for one folder and its child feeds.
 */

import type { MouseEvent, ReactNode } from "react";
import styles from "./FolderGroup.module.css";

interface FolderGroupProps {
  label: string;
  isExpanded: boolean;
  isSelected: boolean;
  onToggle: () => void;
  onSelect: () => void;
  onContextMenu: (event: MouseEvent<HTMLButtonElement>) => void;
  children: ReactNode;
}

/**
 * Renders a folder header with disclosure and its nested feed rows.
 */
export function FolderGroup({
  label,
  isExpanded,
  isSelected,
  onToggle,
  onSelect,
  onContextMenu,
  children,
}: FolderGroupProps) {
  return (
    <section className={styles.group} aria-label={`Folder ${label}`}>
      <div className={styles.headerRow}>
        <button
          type="button"
          className={styles.disclosure}
          onClick={onToggle}
          aria-label={isExpanded ? `Collapse ${label}` : `Expand ${label}`}
        >
          {isExpanded ? "▾" : "▶"}
        </button>
        <button
          type="button"
          className={`${styles.titleButton} ${isSelected ? styles.titleButtonActive : ""}`}
          onClick={onSelect}
          onContextMenu={onContextMenu}
          title={label}
        >
          {label}
        </button>
      </div>
      {isExpanded ? <div className={styles.children}>{children}</div> : null}
    </section>
  );
}
