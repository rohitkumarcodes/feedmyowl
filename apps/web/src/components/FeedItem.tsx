/**
 * Sidebar row for a single feed entry with an overflow action menu.
 */

import { useEffect, useRef, useState, type FormEvent } from "react";
import type { FolderViewModel } from "./feeds-types";
import primitiveStyles from "./LeftPanePrimitives.module.css";
import styles from "./FeedItem.module.css";

interface FeedItemProps {
  label: string;
  isActive: boolean;
  isMobile: boolean;
  isDeleting: boolean;
  isRenaming: boolean;
  isUpdatingFolders: boolean;
  folderOptions: FolderViewModel[];
  selectedFolderIds: string[];
  onSelect: () => void;
  onDelete: () => void;
  onRename: (name: string) => boolean | Promise<boolean>;
  onSaveFolders: (folderIds: string[]) => boolean | Promise<boolean>;
}

/**
 * Renders one feed row with active styling and an overflow control.
 */
export function FeedItem({
  label,
  isActive,
  isMobile,
  isDeleting,
  isRenaming,
  isUpdatingFolders,
  folderOptions,
  selectedFolderIds,
  onSelect,
  onDelete,
  onRename,
  onSaveFolders,
}: FeedItemProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isRenameOpen, setIsRenameOpen] = useState(false);
  const [isFoldersOpen, setIsFoldersOpen] = useState(false);
  const [folderQuery, setFolderQuery] = useState("");
  const [renameValue, setRenameValue] = useState(label);
  const [draftFolderIds, setDraftFolderIds] = useState<string[]>(selectedFolderIds);
  const actionsRef = useRef<HTMLDivElement>(null);
  const renameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isMenuOpen && !isRenameOpen && !isFoldersOpen) {
      return;
    }

    const handlePointerDown = (event: MouseEvent) => {
      if (!actionsRef.current?.contains(event.target as Node)) {
        setIsMenuOpen(false);
        setIsRenameOpen(false);
        setIsFoldersOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsMenuOpen(false);
        setIsRenameOpen(false);
        setIsFoldersOpen(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isFoldersOpen, isMenuOpen, isRenameOpen]);

  useEffect(() => {
    if (isDeleting || isUpdatingFolders) {
      setIsMenuOpen(false);
      setIsRenameOpen(false);
      setIsFoldersOpen(false);
    }
  }, [isDeleting, isUpdatingFolders]);

  useEffect(() => {
    if (!isRenameOpen) {
      return;
    }

    setRenameValue(label);
    window.setTimeout(() => {
      renameInputRef.current?.focus();
      renameInputRef.current?.select();
    }, 0);
  }, [isRenameOpen, label]);

  useEffect(() => {
    if (!isFoldersOpen) {
      return;
    }

    setDraftFolderIds(selectedFolderIds);
    setFolderQuery("");
  }, [isFoldersOpen, selectedFolderIds]);

  const filteredFolderOptions = folderOptions.filter((folder) => {
    const normalizedQuery = folderQuery.trim().toLocaleLowerCase();
    if (!normalizedQuery) {
      return true;
    }

    return folder.name.toLocaleLowerCase().includes(normalizedQuery);
  });

  const handleDelete = () => {
    setIsMenuOpen(false);
    setIsRenameOpen(false);
    onDelete();
  };

  const handleOpenRename = () => {
    setRenameValue(label);
    setIsMenuOpen(false);
    setIsFoldersOpen(false);
    setIsRenameOpen(true);
  };

  const handleOpenFolders = () => {
    setDraftFolderIds(selectedFolderIds);
    setIsMenuOpen(false);
    setIsRenameOpen(false);
    setIsFoldersOpen(true);
  };

  const toggleDraftFolder = (folderId: string) => {
    setDraftFolderIds((previous) =>
      previous.includes(folderId)
        ? previous.filter((candidate) => candidate !== folderId)
        : [...previous, folderId]
    );
  };

  const handleSaveFolders = async () => {
    if (isUpdatingFolders) {
      return;
    }

    const saved = await onSaveFolders(draftFolderIds);
    if (saved) {
      setIsFoldersOpen(false);
      setIsMenuOpen(false);
    }
  };

  const handleRenameSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (isRenaming) {
      return;
    }

    const renamed = await onRename(renameValue);
    if (renamed) {
      setIsRenameOpen(false);
      setIsMenuOpen(false);
    }
  };

  return (
    <div className={`${styles.rowWrap} ${isActive ? styles.rowWrapActive : ""}`}>
      <button
        type="button"
        className={`${primitiveStyles.row} ${primitiveStyles.rowRegular} ${styles.row} ${
          isActive ? primitiveStyles.rowActive : ""
        }`}
        onClick={onSelect}
        title={label}
        aria-current={isActive ? "true" : undefined}
      >
        <span className={styles.label}>{label}</span>
        {selectedFolderIds.length > 1 ? (
          <span
            className={styles.multiFolderBadge}
            title={`In ${selectedFolderIds.length} folders`}
          >
            {selectedFolderIds.length}
          </span>
        ) : null}
      </button>

      <div className={styles.actions} ref={actionsRef}>
        <button
          type="button"
          className={primitiveStyles.iconButton}
          onClick={() => setIsMenuOpen((previous) => !previous)}
          aria-label={`Open actions for ${label}`}
          aria-expanded={isMenuOpen || isRenameOpen || isFoldersOpen}
          disabled={isDeleting || isRenaming || isRenameOpen || isFoldersOpen}
        >
          ⋯
        </button>

        {isRenameOpen ? (
          <>
            {isMobile ? (
              <button
                type="button"
                className={primitiveStyles.mobileBackdrop}
                aria-label={`Close rename dialog for ${label}`}
                onClick={() => setIsRenameOpen(false)}
              />
            ) : null}
            <div
              className={`${primitiveStyles.popover} ${
                isMobile ? primitiveStyles.mobileSheet : primitiveStyles.popoverAnchored
              }`}
              role="dialog"
              aria-label={`Edit name for ${label}`}
              aria-modal={isMobile ? "true" : undefined}
            >
              <form className={styles.renameForm} onSubmit={handleRenameSubmit}>
                <input
                  ref={renameInputRef}
                  type="text"
                  value={renameValue}
                  onChange={(event) => setRenameValue(event.target.value)}
                  className={primitiveStyles.input}
                  placeholder="Leave empty to reset name"
                  maxLength={255}
                  disabled={isRenaming}
                />
                <div className={styles.renameActions}>
                  <button
                    type="submit"
                    className={`${primitiveStyles.button} ${primitiveStyles.buttonCompact}`}
                    disabled={isRenaming}
                  >
                    {isRenaming ? "Saving..." : "Save"}
                  </button>
                  <button
                    type="button"
                    className={`${primitiveStyles.button} ${primitiveStyles.buttonCompact}`}
                    onClick={() => setIsRenameOpen(false)}
                    disabled={isRenaming}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </>
        ) : null}

        {isFoldersOpen ? (
          <>
            {isMobile ? (
              <button
                type="button"
                className={primitiveStyles.mobileBackdrop}
                aria-label={`Close folders dialog for ${label}`}
                onClick={() => setIsFoldersOpen(false)}
              />
            ) : null}
            <div
              className={`${primitiveStyles.popover} ${
                isMobile ? primitiveStyles.mobileSheet : primitiveStyles.popoverAnchored
              }`}
              role="dialog"
              aria-label={`Edit folders for ${label}`}
              aria-modal={isMobile ? "true" : undefined}
            >
              <div className={styles.folderEditor}>
                {folderOptions.length === 0 ? (
                  <p className={styles.folderEditorEmpty}>Create a folder first.</p>
                ) : (
                  <>
                    <input
                      type="text"
                      value={folderQuery}
                      onChange={(event) => setFolderQuery(event.currentTarget.value)}
                      className={primitiveStyles.input}
                      placeholder="Search folders"
                      disabled={isUpdatingFolders}
                    />
                    <div className={styles.folderEditorToolbar}>
                      <button
                        type="button"
                        className={`${primitiveStyles.button} ${primitiveStyles.buttonCompact}`}
                        onClick={() => {
                          const visibleIds = filteredFolderOptions.map((folder) => folder.id);
                          const nextIds = Array.from(
                            new Set([...draftFolderIds, ...visibleIds])
                          );
                          setDraftFolderIds(nextIds);
                        }}
                        disabled={filteredFolderOptions.length === 0 || isUpdatingFolders}
                      >
                        Select all
                      </button>
                      <button
                        type="button"
                        className={`${primitiveStyles.button} ${primitiveStyles.buttonCompact}`}
                        onClick={() => setDraftFolderIds([])}
                        disabled={draftFolderIds.length === 0 || isUpdatingFolders}
                      >
                        Clear
                      </button>
                    </div>
                    {filteredFolderOptions.length === 0 ? (
                      <p className={styles.folderEditorEmpty}>No folders match your search.</p>
                    ) : (
                      <div className={styles.folderEditorList}>
                        {filteredFolderOptions.map((folder) => (
                          <label key={folder.id} className={styles.folderEditorOption}>
                            <input
                              type="checkbox"
                              checked={draftFolderIds.includes(folder.id)}
                              onChange={() => toggleDraftFolder(folder.id)}
                              disabled={isUpdatingFolders}
                            />
                            <span>{folder.name}</span>
                          </label>
                        ))}
                      </div>
                    )}
                  </>
                )}
                <div className={styles.renameActions}>
                  <button
                    type="button"
                    className={`${primitiveStyles.button} ${primitiveStyles.buttonCompact}`}
                    onClick={() => {
                      void handleSaveFolders();
                    }}
                    disabled={isUpdatingFolders}
                  >
                    {isUpdatingFolders ? "Saving..." : "Save"}
                  </button>
                  <button
                    type="button"
                    className={`${primitiveStyles.button} ${primitiveStyles.buttonCompact}`}
                    onClick={() => setIsFoldersOpen(false)}
                    disabled={isUpdatingFolders}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </>
        ) : null}

        {isMenuOpen ? (
          <div className={primitiveStyles.menu}>
            <button
              type="button"
              className={primitiveStyles.menuItem}
              onClick={handleOpenRename}
              disabled={isDeleting || isRenaming}
            >
              Edit name
            </button>
            <button
              type="button"
              className={primitiveStyles.menuItem}
              onClick={handleOpenFolders}
              disabled={isDeleting || isRenaming || isUpdatingFolders}
            >
              Folders...
            </button>
            <button
              type="button"
              className={primitiveStyles.menuItem}
              onClick={handleDelete}
              disabled={isDeleting || isRenaming || isUpdatingFolders}
            >
              {isDeleting ? "Deleting..." : "Delete"}
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
