/**
 * Inline feed-subscription form shared by sidebar and toolbar triggers.
 */

import type { FormEvent } from "react";
import type { FolderViewModel } from "./feeds-types";
import primitiveStyles from "./LeftPanePrimitives.module.css";
import styles from "./AddFeedForm.module.css";

interface AddFeedDiscoveryCandidate {
  url: string;
  title: string | null;
  duplicate: boolean;
}

interface AddFeedBulkSummary {
  processedCount: number;
  importedCount: number;
  duplicateCount: number;
  failedCount: number;
  failedDetails: string[];
}

interface AddFeedFormProps {
  addFeedInputMode: "single" | "bulk";
  addFeedStage: "normalizing" | "discovering" | "awaiting_selection" | "creating" | null;
  discoveryCandidates: AddFeedDiscoveryCandidate[];
  selectedDiscoveryCandidateUrl: string;
  feedUrlInput: string;
  bulkFeedUrlInput: string;
  inlineDuplicateMessage: string | null;
  bulkAddResultRows: Array<{
    url: string;
    status: "imported" | "duplicate" | "failed";
    message?: string;
  }> | null;
  bulkAddSummary: AddFeedBulkSummary | null;
  isAddingFeed: boolean;
  availableFolders: FolderViewModel[];
  selectedFolderIds: string[];
  newFolderNameInput: string;
  isCreatingFolder: boolean;
  onAddFeedInputModeChange: (mode: "single" | "bulk") => void;
  onFeedUrlChange: (value: string) => void;
  onBulkFeedUrlChange: (value: string) => void;
  onToggleFolder: (folderId: string) => void;
  onNewFolderNameChange: (value: string) => void;
  onSelectDiscoveryCandidate: (url: string) => void;
  onCreateFolderFromForm: () => void;
  onSubmitFeed: (event: FormEvent<HTMLFormElement>) => void;
  onCancelAddFeed: () => void;
}

/**
 * Renders a compact inline feed/site URL form.
 */
export function AddFeedForm({
  addFeedInputMode,
  addFeedStage,
  discoveryCandidates,
  selectedDiscoveryCandidateUrl,
  feedUrlInput,
  bulkFeedUrlInput,
  inlineDuplicateMessage,
  bulkAddResultRows,
  bulkAddSummary,
  isAddingFeed,
  availableFolders,
  selectedFolderIds,
  newFolderNameInput,
  isCreatingFolder,
  onAddFeedInputModeChange,
  onFeedUrlChange,
  onBulkFeedUrlChange,
  onToggleFolder,
  onNewFolderNameChange,
  onSelectDiscoveryCandidate,
  onCreateFolderFromForm,
  onSubmitFeed,
  onCancelAddFeed,
}: AddFeedFormProps) {
  const addableDiscoveryCandidates = discoveryCandidates.filter(
    (candidate) => !candidate.duplicate
  );
  const requiresSelection =
    addFeedInputMode === "single" && addableDiscoveryCandidates.length > 1;
  const hasValidSelection =
    !requiresSelection ||
    addableDiscoveryCandidates.some(
      (candidate) => candidate.url === selectedDiscoveryCandidateUrl
    );

  const submitLabel = isAddingFeed
    ? addFeedStage === "normalizing"
      ? "Normalizing..."
      : addFeedStage === "discovering"
        ? "Discovering..."
        : addFeedStage === "creating"
          ? "Adding..."
          : "Working..."
    : addFeedInputMode === "bulk"
      ? "Add feeds"
      : requiresSelection
        ? "Add selected feed"
        : "Add feed";

  const isSubmitDisabled =
    isAddingFeed ||
    (addFeedInputMode === "single" && Boolean(inlineDuplicateMessage)) ||
    !hasValidSelection;

  return (
    <form className={`${styles.form} ${primitiveStyles.panel}`} onSubmit={onSubmitFeed}>
      <fieldset className={styles.modeFieldset}>
        <legend className={styles.label}>Input mode</legend>
        <div className={styles.modeOptions}>
          <label className={styles.modeOption}>
            <input
              type="radio"
              name="add-feed-mode"
              value="single"
              checked={addFeedInputMode === "single"}
              onChange={() => onAddFeedInputModeChange("single")}
              disabled={isAddingFeed}
            />
            <span>Single URL</span>
          </label>
          <label className={styles.modeOption}>
            <input
              type="radio"
              name="add-feed-mode"
              value="bulk"
              checked={addFeedInputMode === "bulk"}
              onChange={() => onAddFeedInputModeChange("bulk")}
              disabled={isAddingFeed}
            />
            <span>Paste many</span>
          </label>
        </div>
      </fieldset>

      {addFeedInputMode === "single" ? (
        <>
          <label className={styles.label} htmlFor="sidebar-feed-url">
            Feed or site URL
          </label>
          <input
            id="sidebar-feed-url"
            name="feed-url"
            type="text"
            required
            className={primitiveStyles.input}
            value={feedUrlInput}
            onChange={(event) => onFeedUrlChange(event.currentTarget.value)}
            placeholder="example.com or https://example.com/rss.xml"
          />
          {inlineDuplicateMessage ? (
            <p className={styles.inlineMessage}>{inlineDuplicateMessage}</p>
          ) : null}

          {requiresSelection ? (
            <fieldset className={styles.discoveryFieldset}>
              <legend className={styles.label}>Choose one discovered feed URL</legend>
              <div className={styles.discoveryList}>
                {discoveryCandidates.map((candidate) => (
                  <label key={candidate.url} className={styles.discoveryOption}>
                    <input
                      type="radio"
                      name="discovered-feed"
                      checked={selectedDiscoveryCandidateUrl === candidate.url}
                      onChange={() => onSelectDiscoveryCandidate(candidate.url)}
                      disabled={candidate.duplicate || isAddingFeed}
                    />
                    <span className={styles.discoveryText}>
                      <span>{candidate.title || candidate.url}</span>
                      <span className={styles.discoveryUrl}>
                        {candidate.url}
                        {candidate.duplicate ? " — already in library" : ""}
                      </span>
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>
          ) : null}
        </>
      ) : (
        <>
          <label className={styles.label} htmlFor="sidebar-feed-urls">
            Feed or site URLs (one per line)
          </label>
          <textarea
            id="sidebar-feed-urls"
            name="feed-urls"
            required
            className={`${primitiveStyles.input} ${styles.bulkTextarea}`}
            value={bulkFeedUrlInput}
            onChange={(event) => onBulkFeedUrlChange(event.currentTarget.value)}
            placeholder={"example.com\nhttps://example.com/rss.xml"}
          />
          {bulkAddSummary ? (
            <div className={styles.bulkSummary}>
              <p>
                Processed {bulkAddSummary.processedCount} URL
                {bulkAddSummary.processedCount === 1 ? "" : "s"}. Imported{" "}
                {bulkAddSummary.importedCount}, skipped {bulkAddSummary.duplicateCount}{" "}
                duplicate{bulkAddSummary.duplicateCount === 1 ? "" : "s"}, failed{" "}
                {bulkAddSummary.failedCount}.
              </p>
              {bulkAddSummary.failedDetails.length > 0 ? (
                <ul className={styles.bulkFailures}>
                  {bulkAddSummary.failedDetails.map((detail) => (
                    <li key={detail}>{detail}</li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : null}
          {bulkAddResultRows && bulkAddResultRows.length === 0 ? (
            <p className={styles.inlineMessage}>No URLs were processed.</p>
          ) : null}
        </>
      )}

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
          className={primitiveStyles.input}
          value={newFolderNameInput}
          onChange={(event) => onNewFolderNameChange(event.currentTarget.value)}
          placeholder="New folder name"
          maxLength={255}
          disabled={isCreatingFolder || isAddingFeed}
        />
        <button
          type="button"
          className={primitiveStyles.button}
          onClick={onCreateFolderFromForm}
          disabled={isCreatingFolder || isAddingFeed}
        >
          {isCreatingFolder ? "Creating folder..." : "Create folder"}
        </button>
      </div>

      <div className={styles.actions}>
        <button type="submit" className={primitiveStyles.button} disabled={isSubmitDisabled}>
          {submitLabel}
        </button>
        <button
          type="button"
          className={primitiveStyles.button}
          onClick={onCancelAddFeed}
          disabled={isAddingFeed}
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
