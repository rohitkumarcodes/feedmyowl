/**
 * Inline feed-subscription form shared by sidebar and toolbar triggers.
 */

import type { FormEvent } from "react";
import type { FolderViewModel } from "./feeds-types";
import styles from "./AddFeedForm.module.css";

interface AddFeedFormProps {
  feedUrlInput: string;
  isAddingFeed: boolean;
  availableFolders: FolderViewModel[];
  selectedFolderIds: string[];
  newFolderNameInput: string;
  isCreatingFolder: boolean;
  onFeedUrlChange: (value: string) => void;
  onToggleFolder: (folderId: string) => void;
  onNewFolderNameChange: (value: string) => void;
  onCreateFolderFromForm: () => void;
  onSubmitFeed: (event: FormEvent<HTMLFormElement>) => void;
  onCancelAddFeed: () => void;
}

/**
 * Renders a compact inline feed/site URL form.
 */
export function AddFeedForm({
  feedUrlInput,
  isAddingFeed,
  availableFolders,
  selectedFolderIds,
  newFolderNameInput,
  isCreatingFolder,
  onFeedUrlChange,
  onToggleFolder,
  onNewFolderNameChange,
  onCreateFolderFromForm,
  onSubmitFeed,
  onCancelAddFeed,
}: AddFeedFormProps) {
  return (
    <form className={styles.form} onSubmit={onSubmitFeed}>
      <label className={styles.label} htmlFor="sidebar-feed-url">
        Feed or site URL
      </label>
      <input
        id="sidebar-feed-url"
        name="feed-url"
        type="url"
        required
        className={styles.input}
        value={feedUrlInput}
        onChange={(event) => onFeedUrlChange(event.currentTarget.value)}
        placeholder="https://example.com or https://example.com/rss.xml"
      />

      <fieldset className={styles.folderFieldset}>
        <legend className={styles.label}>Folders</legend>
        {availableFolders.length === 0 ? (
          <p className={styles.folderEmpty}>No folders yet. Create one below.</p>
        ) : (
          <div className={styles.folderList}>
            {availableFolders.map((folder) => {
              const isChecked = selectedFolderIds.includes(folder.id);

              return (
                <label key={folder.id} className={styles.folderOption}>
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => onToggleFolder(folder.id)}
                  />
                  <span>{folder.name}</span>
                </label>
              );
            })}
          </div>
        )}
      </fieldset>

      <div className={styles.inlineFolderCreate}>
        <input
          type="text"
          className={styles.input}
          value={newFolderNameInput}
          onChange={(event) => onNewFolderNameChange(event.currentTarget.value)}
          placeholder="New folder name"
          maxLength={255}
          disabled={isCreatingFolder || isAddingFeed}
        />
        <button
          type="button"
          className={styles.button}
          onClick={onCreateFolderFromForm}
          disabled={isCreatingFolder || isAddingFeed}
        >
          {isCreatingFolder ? "Creating..." : "Create folder"}
        </button>
      </div>

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
