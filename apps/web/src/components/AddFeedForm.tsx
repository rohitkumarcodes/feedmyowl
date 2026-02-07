/**
 * Inline feed-subscription form shared by sidebar and toolbar triggers.
 */

import type { FormEvent } from "react";
import type { FolderViewModel } from "./feeds-types";
import styles from "./AddFeedForm.module.css";

interface AddFeedFormProps {
  folders: FolderViewModel[];
  feedUrlInput: string;
  feedFolderIdInput: string;
  isAddingFeed: boolean;
  onFeedUrlChange: (value: string) => void;
  onFeedFolderIdChange: (value: string) => void;
  onSubmitFeed: (event: FormEvent<HTMLFormElement>) => void;
  onCancelAddFeed: () => void;
}

/**
 * Renders a compact inline feed URL form with optional folder assignment.
 */
export function AddFeedForm({
  folders,
  feedUrlInput,
  feedFolderIdInput,
  isAddingFeed,
  onFeedUrlChange,
  onFeedFolderIdChange,
  onSubmitFeed,
  onCancelAddFeed,
}: AddFeedFormProps) {
  const sortedFolders = [...folders].sort((a, b) => a.name.localeCompare(b.name));

  return (
    <form className={styles.form} onSubmit={onSubmitFeed}>
      <label className={styles.label} htmlFor="sidebar-feed-url">
        Feed URL
      </label>
      <input
        id="sidebar-feed-url"
        name="feed-url"
        type="url"
        required
        className={styles.input}
        value={feedUrlInput}
        onChange={(event) => onFeedUrlChange(event.currentTarget.value)}
        placeholder="https://example.com/rss.xml"
      />

      <label className={styles.label} htmlFor="sidebar-feed-folder">
        Folder
      </label>
      <select
        id="sidebar-feed-folder"
        className={styles.select}
        value={feedFolderIdInput}
        onChange={(event) => onFeedFolderIdChange(event.currentTarget.value)}
      >
        <option value="">Uncategorized</option>
        {sortedFolders.map((folder) => (
          <option key={folder.id} value={folder.id}>
            {folder.name}
          </option>
        ))}
      </select>

      <div className={styles.actions}>
        <button type="submit" className={styles.button} disabled={isAddingFeed}>
          {isAddingFeed ? "Adding..." : "Add"}
        </button>
        <button
          type="button"
          className={styles.button}
          onClick={onCancelAddFeed}
          disabled={isAddingFeed}
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
