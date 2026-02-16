/**
 * Inline feed-subscription form shared by sidebar and toolbar triggers.
 */

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from "react";
import {
  getDiscoveryBadgeFlags,
  type DiscoveryBadgeCandidate,
} from "./add-feed-discovery-badges";
import type { FolderViewModel } from "@/features/feeds/types/view-models";
import { isReservedFolderName } from "@/lib/shared/folders";
import primitiveStyles from "./LeftPanePrimitives.module.css";
import styles from "./AddFeedForm.module.css";

interface AddFeedDiscoveryCandidate extends DiscoveryBadgeCandidate {
  existingFeedId?: string | null;
}

export interface AddFeedFormProps {
  presentation?: "inline" | "dialog";
  addFeedStage: "normalizing" | "discovering" | "awaiting_selection" | "creating" | null;
  discoveryCandidates: AddFeedDiscoveryCandidate[];
  selectedDiscoveryCandidateUrl: string;
  feedUrlInput: string;
  inlineDuplicateMessage: string | null;
  isAddingFeed: boolean;
  availableFolders: FolderViewModel[];
  selectedFolderIds: string[];
  newFolderNameInput: string;
  isCreatingFolder: boolean;
  createdFolderRenameId?: string | null;
  onFeedUrlChange: (value: string) => void;
  onToggleFolder: (folderId: string) => void;
  onNewFolderNameChange: (value: string) => void;
  onSelectDiscoveryCandidate: (url: string) => void;
  onCreateFolderFromForm: () => void;
  onRenameFolderFromForm: (folderId: string, name: string) => Promise<boolean> | boolean;
  onDismissCreatedFolderRename: () => void;
  onOpenExistingFeed: (url: string) => void;
  onSubmitFeed: (event: FormEvent<HTMLFormElement>) => void;
  onCancelAddFeed: () => void;
}

/**
 * Renders feed/site URL input and folder assignment controls.
 */
export function AddFeedForm({
  presentation = "inline",
  addFeedStage,
  discoveryCandidates,
  selectedDiscoveryCandidateUrl,
  feedUrlInput,
  inlineDuplicateMessage,
  isAddingFeed,
  availableFolders,
  selectedFolderIds,
  newFolderNameInput,
  isCreatingFolder,
  createdFolderRenameId,
  onFeedUrlChange,
  onToggleFolder,
  onNewFolderNameChange,
  onSelectDiscoveryCandidate,
  onCreateFolderFromForm,
  onRenameFolderFromForm,
  onDismissCreatedFolderRename,
  onOpenExistingFeed,
  onSubmitFeed,
  onCancelAddFeed,
}: AddFeedFormProps) {
  const [renameCreatedFolderValue, setRenameCreatedFolderValue] = useState("");
  const [isRenamingCreatedFolder, setIsRenamingCreatedFolder] = useState(false);
  const createdFolderInputRef = useRef<HTMLInputElement>(null);

  const addableDiscoveryCandidates = discoveryCandidates.filter(
    (candidate) => !candidate.duplicate,
  );
  const requiresSelection = addableDiscoveryCandidates.length > 1;
  const hasValidSelection =
    !requiresSelection ||
    addableDiscoveryCandidates.some(
      (candidate) => candidate.url === selectedDiscoveryCandidateUrl,
    );

  const submitLabel = isAddingFeed
    ? addFeedStage === "normalizing"
      ? "Normalizing..."
      : addFeedStage === "discovering"
        ? "Discovering..."
        : addFeedStage === "creating"
          ? "Adding..."
          : "Working..."
    : requiresSelection
      ? "Add selected feed"
      : "Add feed";

  const isSubmitDisabled =
    isAddingFeed || Boolean(inlineDuplicateMessage) || !hasValidSelection;

  const normalizedNewFolderName = newFolderNameInput.trim().toLocaleLowerCase();
  const isNewFolderReserved = isReservedFolderName(normalizedNewFolderName);
  const duplicateFolder =
    normalizedNewFolderName.length > 0 && !isNewFolderReserved
      ? availableFolders.find(
          (folder) => folder.name.trim().toLocaleLowerCase() === normalizedNewFolderName,
        )
      : undefined;

  const canCreateFolder =
    newFolderNameInput.trim().length > 0 &&
    !isNewFolderReserved &&
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

  const createdFolder = useMemo(
    () =>
      createdFolderRenameId
        ? (availableFolders.find((folder) => folder.id === createdFolderRenameId) ?? null)
        : null,
    [availableFolders, createdFolderRenameId],
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

  const handleInlineFolderInputKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== "Enter") {
      return;
    }

    event.preventDefault();
    if (canCreateFolder) {
      onCreateFolderFromForm();
    }
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
    const renamed = await onRenameFolderFromForm(
      createdFolder.id,
      renameCreatedFolderValue,
    );
    setIsRenamingCreatedFolder(false);

    if (renamed) {
      onDismissCreatedFolderRename();
    }
  };

  return (
    <form className={formClassName} onSubmit={onSubmitFeed}>
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

      {availableFolders.length > 0 ? (
        <fieldset className={styles.folderFieldset}>
          <legend className={styles.label}>Folders</legend>
          <div className={styles.folderList}>
            {availableFolders.map((folder) => {
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
        </fieldset>
      ) : null}

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

      {isNewFolderReserved ? (
        <div className={styles.inlineDuplicateRow}>
          <p className={styles.inlineMessage}>This name is reserved.</p>
        </div>
      ) : duplicateFolder ? (
        <div className={styles.inlineDuplicateRow}>
          <p className={styles.inlineMessage}>
            A folder named &quot;{duplicateFolder.name}&quot; already exists.
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
        <button
          type="submit"
          className={primitiveStyles.button}
          disabled={isSubmitDisabled}
        >
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
