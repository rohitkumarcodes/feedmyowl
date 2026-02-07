/**
 * Expandable sidebar section for one folder and its child feeds.
 */

import type { ReactNode } from "react";
import styles from "./FolderGroup.module.css";

interface FolderGroupProps {
  label: string;
  isExpanded: boolean;
  isSelected: boolean;
  onToggle?: () => void;
  onSelect: () => void;
  onRename?: () => void;
  onDelete?: () => void;
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
  onRename,
  onDelete,
  children,
}: FolderGroupProps) {
  return (
    <section className={styles.group} aria-label={`Folder ${label}`}>
      <div className={styles.headerRow}>
        {onToggle ? (
          <button
            type="button"
            className={styles.disclosure}
            onClick={onToggle}
            aria-expanded={isExpanded}
            aria-label={isExpanded ? `Collapse ${label}` : `Expand ${label}`}
          >
            {isExpanded ? "▾" : "▶"}
          </button>
        ) : (
          <span className={styles.disclosureSpacer} aria-hidden="true" />
        )}
        <button
          type="button"
          className={`${styles.titleButton} ${isSelected ? styles.titleButtonActive : ""}`}
          onClick={onSelect}
          title={label}
          aria-current={isSelected ? "true" : undefined}
        >
          {label}
        </button>

        {onRename ? (
          <button
            type="button"
            className={styles.inlineAction}
            onClick={onRename}
          >
            Rename
          </button>
        ) : null}

        {onDelete ? (
          <button
            type="button"
            className={styles.inlineAction}
            onClick={onDelete}
          >
            Delete
          </button>
        ) : null}
      </div>
      {isExpanded ? <div className={styles.children}>{children}</div> : null}
    </section>
  );
}
