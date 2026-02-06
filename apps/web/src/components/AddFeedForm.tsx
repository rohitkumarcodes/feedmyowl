/**
 * Inline add-feed form shown beneath the toolbar or from sidebar affordance.
 */

import type { FormEvent } from "react";
import type { FolderViewModel } from "./feeds-types";
import styles from "./AddFeedForm.module.css";

interface AddFeedFormProps {
  folders: FolderViewModel[];
  url: string;
  folderId: string;
  isSubmitting: boolean;
  onUrlChange: (value: string) => void;
  onFolderIdChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}

/**
 * Renders the one-field feed URL form plus optional folder assignment selector.
 */
export function AddFeedForm({
  folders,
  url,
  folderId,
  isSubmitting,
  onUrlChange,
  onFolderIdChange,
  onSubmit,
}: AddFeedFormProps) {
  const sortedFolders = [...folders].sort((a, b) => a.name.localeCompare(b.name));

  return (
    <form className={styles.form} onSubmit={onSubmit}>
      <label className={styles.label} htmlFor="add-feed-url">
        Feed URL
      </label>
      <input
        id="add-feed-url"
        name="feed-url"
        type="url"
        required
        value={url}
        onChange={(event) => onUrlChange(event.currentTarget.value)}
        placeholder="https://example.com/rss.xml"
        className={styles.input}
      />

      <label className={styles.label} htmlFor="add-feed-folder">
        Folder
      </label>
      <select
        id="add-feed-folder"
        value={folderId}
        onChange={(event) => onFolderIdChange(event.currentTarget.value)}
        className={styles.select}
      >
        <option value="">Uncategorized</option>
        {sortedFolders.map((folder) => (
          <option key={folder.id} value={folder.id}>
            {folder.name}
          </option>
        ))}
      </select>

      <button type="submit" className={styles.submitButton} disabled={isSubmitting}>
        {isSubmitting ? "Adding..." : "Add Feed"}
      </button>
    </form>
  );
}
