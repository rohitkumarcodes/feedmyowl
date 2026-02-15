const RESERVED_FOLDER_NAMES_SET = new Set(["all feeds", "saved", "uncategorized"]);

/**
 * Folder names that match built-in sidebar scope labels (case-insensitive).
 *
 * Exposed as a ReadonlySet to discourage mutation at call sites.
 */
export const RESERVED_FOLDER_NAMES: ReadonlySet<string> = RESERVED_FOLDER_NAMES_SET;

export function isReservedFolderName(name: string): boolean {
  const normalized = name.trim().toLocaleLowerCase();
  if (!normalized) {
    return false;
  }
  return RESERVED_FOLDER_NAMES_SET.has(normalized);
}
