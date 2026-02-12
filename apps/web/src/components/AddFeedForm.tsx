/**
 * Inline feed-subscription form shared by sidebar and toolbar triggers.
 */

import { useEffect, useMemo, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import {
  getDiscoveryBadgeFlags,
  type DiscoveryBadgeCandidate,
} from "./add-feed-discovery-badges";
import type { FolderViewModel } from "./feeds-types";
import primitiveStyles from "./LeftPanePrimitives.module.css";
import styles from "./AddFeedForm.module.css";

interface AddFeedDiscoveryCandidate extends DiscoveryBadgeCandidate {
  existingFeedId?: string | null;
}

interface AddFeedBulkSummary {
  processedCount: number;
  importedCount: number;
  mergedCount: number;
  duplicateUnchangedCount: number;
  failedCount: number;
  failedDetails: string[];
}

export interface AddFeedFormProps {
  presentation?: "inline" | "dialog";
  addFeedInputMode: "single" | "bulk";
  addFeedStage: "normalizing" | "discovering" | "awaiting_selection" | "creating" | null;
  discoveryCandidates: AddFeedDiscoveryCandidate[];
  selectedDiscoveryCandidateUrl: string;
  feedUrlInput: string;
  bulkFeedUrlInput: string;
  inlineDuplicateMessage: string | null;
  bulkAddResultRows: Array<{
    url: string;
    status: "imported" | "merged" | "duplicate" | "failed";
    message?: string;
  }> | null;
  bulkAddSummary: AddFeedBulkSummary | null;
  isAddingFeed: boolean;
  availableFolders: FolderViewModel[];
  selectedFolderIds: string[];
  newFolderNameInput: string;
  isCreatingFolder: boolean;
  createdFolderRenameId?: string | null;
  onAddFeedInputModeChange: (mode: "single" | "bulk") => void;
  onFeedUrlChange: (value: string) => void;
  onBulkFeedUrlChange: (value: string) => void;
  onToggleFolder: (folderId: string) => void;
  onSetSelectedFolders: (folderIds: string[]) => void;
  onNewFolderNameChange: (value: string) => void;
  onSelectDiscoveryCandidate: (url: string) => void;
  onCreateFolderFromForm: () => void;
  onRenameFolderFromForm: (folderId: string, name: string) => Promise<boolean> | boolean;
  onDismissCreatedFolderRename: () => void;
  onOpenExistingFeed: (url: string) => void;
  onRetryFailedBulk: () => void;
  onCopyFailedUrls: () => void;
  onSubmitFeed: (event: FormEvent<HTMLFormElement>) => void;
  onCancelAddFeed: () => void;
}

/**
 * Renders feed/site URL input and folder assignment controls.
 */
export function AddFeedForm({
  presentation = "inline",
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
  createdFolderRenameId,
  onAddFeedInputModeChange,
  onFeedUrlChange,
  onBulkFeedUrlChange,
  onToggleFolder,
  onSetSelectedFolders,
  onNewFolderNameChange,
  onSelectDiscoveryCandidate,
  onCreateFolderFromForm,
  onRenameFolderFromForm,
  onDismissCreatedFolderRename,
  onOpenExistingFeed,
  onRetryFailedBulk,
  onCopyFailedUrls,
  onSubmitFeed,
  onCancelAddFeed,
}: AddFeedFormProps) {
  const [folderQuery, setFolderQuery] = useState("");
  const [expandedFailureUrls, setExpandedFailureUrls] = useState<Record<string, boolean>>(
    {}
  );
  const [renameCreatedFolderValue, setRenameCreatedFolderValue] = useState("");
  const [isRenamingCreatedFolder, setIsRenamingCreatedFolder] = useState(false);
  const createdFolderInputRef = useRef<HTMLInputElement>(null);

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

  const normalizedNewFolderName = newFolderNameInput.trim().toLocaleLowerCase();
  const duplicateFolder =
    normalizedNewFolderName.length > 0
      ? availableFolders.find(
          (folder) => folder.name.trim().toLocaleLowerCase() === normalizedNewFolderName
        )
      : undefined;

  const canCreateFolder =
    newFolderNameInput.trim().length > 0 &&
    !duplicateFolder &&
    !isCreatingFolder &&
    !isAddingFeed;

  const formClassName = [
    styles.form,
    presentation === "inline" ? primitiveStyles.panel : "",
    presentation === "dialog" ? styles.formDialog : "",
  ]
    .filter(Boolean)
    .join(" ");

  const filteredFolders = useMemo(() => {
    const query = folderQuery.trim().toLocaleLowerCase();

    if (!query) {
      return availableFolders;
    }

    return availableFolders.filter((folder) =>
      folder.name.toLocaleLowerCase().includes(query)
    );
  }, [availableFolders, folderQuery]);

  const failedRows = useMemo(
    () => (bulkAddResultRows ?? []).filter((row) => row.status === "failed"),
    [bulkAddResultRows]
  );

  const createdFolder = useMemo(
    () =>
      createdFolderRenameId
        ? availableFolders.find((folder) => folder.id === createdFolderRenameId) ?? null
        : null,
    [availableFolders, createdFolderRenameId]
  );

  useEffect(() => {
    if (!createdFolder) {
      setRenameCreatedFolderValue("");
      setIsRenamingCreatedFolder(false);
      return;
    }

    setRenameCreatedFolderValue(createdFolder.name);
    window.setTimeout(() => {
      createdFolderInputRef.current?.focus();
      createdFolderInputRef.current?.select();
    }, 0);
  }, [createdFolder]);

  const handleInlineFolderInputKeyDown = (
    event: KeyboardEvent<HTMLInputElement>
  ) => {
    if (event.key !== "Enter") {
      return;
    }

    event.preventDefault();
    if (canCreateFolder) {
      onCreateFolderFromForm();
    }
  };

  const toggleFailureDetails = (url: string) => {
    setExpandedFailureUrls((previous) => ({
      ...previous,
      [url]: !previous[url],
    }));
  };

  const handleSelectAllFilteredFolders = () => {
    const filteredFolderIds = filteredFolders.map((folder) => folder.id);
    const nextFolderIds = Array.from(new Set([...selectedFolderIds, ...filteredFolderIds]));
    onSetSelectedFolders(nextFolderIds);
  };

  const handleClearAllFolders = () => {
    onSetSelectedFolders([]);
  };

  const handleUseExistingFolder = () => {
    if (!duplicateFolder) {
      return;
    }

    if (!selectedFolderIds.includes(duplicateFolder.id)) {
      onToggleFolder(duplicateFolder.id);
    }

    onNewFolderNameChange("");
  };

  const handleRenameCreatedFolder = async () => {
    if (!createdFolder || isRenamingCreatedFolder) {
      return;
    }

    setIsRenamingCreatedFolder(true);
    const renamed = await onRenameFolderFromForm(createdFolder.id, renameCreatedFolderValue);
    setIsRenamingCreatedFolder(false);

    if (renamed) {
      onDismissCreatedFolderRename();
    }
  };

  return (
    <form className={formClassName} onSubmit={onSubmitFeed}>
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
            <div className={styles.inlineDuplicateRow}>
              <p className={styles.inlineMessage}>{inlineDuplicateMessage}</p>
              <button
                type="button"
                className={`${primitiveStyles.button} ${primitiveStyles.buttonCompact}`}
                onClick={() => onOpenExistingFeed(feedUrlInput)}
              >
                Open existing feed
              </button>
            </div>
          ) : null}

          {requiresSelection ? (
            <fieldset className={styles.discoveryFieldset}>
              <legend className={styles.label}>Choose one discovered feed URL</legend>
              <div className={styles.discoveryList}>
                {discoveryCandidates.map((candidate) => {
                  const badgeFlags = getDiscoveryBadgeFlags({
                    candidate,
                    addableCandidateCount: addableDiscoveryCandidates.length,
                  });

                  return (
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
                        <span className={styles.discoveryUrl}>{candidate.url}</span>
                        <span className={styles.discoveryBadges}>
                          {badgeFlags.alreadyInLibrary ? (
                            <span className={styles.badge}>Already in library</span>
                          ) : null}
                          {badgeFlags.recommended ? (
                            <span className={`${styles.badge} ${styles.badgeRecommended}`}>
                              Recommended
                            </span>
                          ) : null}
                          {badgeFlags.likelyCommentsFeed ? (
                            <span className={styles.badge}>Likely comments feed</span>
                          ) : null}
                        </span>
                        {candidate.duplicate ? (
                          <button
                            type="button"
                            className={`${primitiveStyles.button} ${primitiveStyles.buttonCompact}`}
                            onClick={() => onOpenExistingFeed(candidate.url)}
                          >
                            Open existing feed
                          </button>
                        ) : null}
                      </span>
                    </label>
                  );
                })}
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
                {bulkAddSummary.importedCount}, merged {bulkAddSummary.mergedCount}{" "}
                duplicate assignment{bulkAddSummary.mergedCount === 1 ? "" : "s"},
                skipped {bulkAddSummary.duplicateUnchangedCount} unchanged duplicate
                {bulkAddSummary.duplicateUnchangedCount === 1 ? "" : "s"}, failed{" "}
                {bulkAddSummary.failedCount}.
              </p>
            </div>
          ) : null}

          {bulkAddResultRows && bulkAddResultRows.length > 0 ? (
            <div className={styles.bulkTableWrap}>
              <div className={styles.bulkTableActions}>
                <button
                  type="button"
                  className={`${primitiveStyles.button} ${primitiveStyles.buttonCompact}`}
                  onClick={onRetryFailedBulk}
                  disabled={failedRows.length === 0 || isAddingFeed}
                >
                  Retry failed
                </button>
                <button
                  type="button"
                  className={`${primitiveStyles.button} ${primitiveStyles.buttonCompact}`}
                  onClick={onCopyFailedUrls}
                  disabled={failedRows.length === 0}
                >
                  Copy failed URLs
                </button>
              </div>
              <table className={styles.bulkTable}>
                <thead>
                  <tr>
                    <th>URL</th>
                    <th>Status</th>
                    <th>Details</th>
                  </tr>
                </thead>
                <tbody>
                  {bulkAddResultRows.map((row) => {
                    const isFailed = row.status === "failed";
                    const isExpanded = Boolean(expandedFailureUrls[row.url]);

                    return (
                      <tr key={`${row.url}-${row.status}`}>
                        <td className={styles.bulkUrlCell}>{row.url}</td>
                        <td>
                          <span className={`${styles.statusChip} ${styles[`statusChip${row.status}`]}`}>
                            {row.status}
                          </span>
                        </td>
                        <td>
                          {isFailed ? (
                            <>
                              <button
                                type="button"
                                className={`${primitiveStyles.button} ${primitiveStyles.buttonCompact}`}
                                onClick={() => toggleFailureDetails(row.url)}
                              >
                                {isExpanded ? "Hide" : "Show"}
                              </button>
                              {isExpanded ? (
                                <p className={styles.bulkFailureDetail}>
                                  {row.message || "Could not import."}
                                </p>
                              ) : null}
                            </>
                          ) : (
                            <span className={styles.bulkDetailMuted}>-</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : null}

          {bulkAddResultRows && bulkAddResultRows.length === 0 ? (
            <p className={styles.inlineMessage}>No URLs were processed.</p>
          ) : null}
        </>
      )}

      <fieldset className={styles.folderFieldset}>
        <legend className={styles.label}>Folders</legend>
        <div className={styles.folderTools}>
          <input
            type="text"
            className={primitiveStyles.input}
            value={folderQuery}
            onChange={(event) => setFolderQuery(event.currentTarget.value)}
            placeholder="Search folders"
            disabled={isAddingFeed || isCreatingFolder || availableFolders.length === 0}
          />
          <div className={styles.folderToolActions}>
            <button
              type="button"
              className={`${primitiveStyles.button} ${primitiveStyles.buttonCompact}`}
              onClick={handleSelectAllFilteredFolders}
              disabled={filteredFolders.length === 0 || isAddingFeed || isCreatingFolder}
            >
              Select all
            </button>
            <button
              type="button"
              className={`${primitiveStyles.button} ${primitiveStyles.buttonCompact}`}
              onClick={handleClearAllFolders}
              disabled={selectedFolderIds.length === 0 || isAddingFeed || isCreatingFolder}
            >
              Clear
            </button>
          </div>
        </div>

        {availableFolders.length === 0 ? (
          <p className={styles.folderEmpty}>No folders yet. Create one below.</p>
        ) : filteredFolders.length === 0 ? (
          <p className={styles.folderEmpty}>No folders match your search.</p>
        ) : (
          <div className={styles.folderList}>
            {filteredFolders.map((folder) => {
              const isChecked = selectedFolderIds.includes(folder.id);

              return (
                <label key={folder.id} className={styles.folderOption}>
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => onToggleFolder(folder.id)}
                    disabled={isAddingFeed || isCreatingFolder}
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
          onKeyDown={handleInlineFolderInputKeyDown}
          placeholder="New folder name"
          maxLength={255}
          disabled={isCreatingFolder || isAddingFeed}
        />
        <button
          type="button"
          className={primitiveStyles.button}
          onClick={onCreateFolderFromForm}
          disabled={!canCreateFolder}
        >
          {isCreatingFolder ? "Creating folder..." : "Create folder"}
        </button>
      </div>

      {duplicateFolder ? (
        <div className={styles.inlineDuplicateRow}>
          <p className={styles.inlineMessage}>
            A folder named "{duplicateFolder.name}" already exists.
          </p>
          <button
            type="button"
            className={`${primitiveStyles.button} ${primitiveStyles.buttonCompact}`}
            onClick={handleUseExistingFolder}
          >
            Use existing
          </button>
        </div>
      ) : null}

      {createdFolder ? (
        <div className={styles.createdFolderRename}>
          <p className={styles.inlineMessage}>Folder created. Rename now (optional).</p>
          <div className={styles.createdFolderRenameRow}>
            <input
              ref={createdFolderInputRef}
              type="text"
              className={primitiveStyles.input}
              value={renameCreatedFolderValue}
              onChange={(event) => setRenameCreatedFolderValue(event.currentTarget.value)}
              maxLength={255}
              disabled={isRenamingCreatedFolder}
            />
            <button
              type="button"
              className={`${primitiveStyles.button} ${primitiveStyles.buttonCompact}`}
              onClick={() => {
                void handleRenameCreatedFolder();
              }}
              disabled={isRenamingCreatedFolder}
            >
              {isRenamingCreatedFolder ? "Saving..." : "Save"}
            </button>
            <button
              type="button"
              className={`${primitiveStyles.button} ${primitiveStyles.buttonCompact}`}
              onClick={onDismissCreatedFolderRename}
              disabled={isRenamingCreatedFolder}
            >
              Skip
            </button>
          </div>
        </div>
      ) : null}

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
