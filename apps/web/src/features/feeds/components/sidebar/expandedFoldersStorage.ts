"use client";

const EXPANDED_FOLDERS_STORAGE_KEY = "feedmyowl:expandedFolders";

/**
 * Read persisted folder expansion state from localStorage.
 * Returns an empty object if nothing is stored or parsing fails.
 */
export function readExpandedFolders(): Record<string, boolean> {
  try {
    const raw = localStorage.getItem(EXPANDED_FOLDERS_STORAGE_KEY);
    if (!raw) {
      return {};
    }

    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)) {
      return parsed as Record<string, boolean>;
    }

    return {};
  } catch {
    return {};
  }
}

export function writeExpandedFolders(state: Record<string, boolean>): void {
  try {
    localStorage.setItem(EXPANDED_FOLDERS_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Storage full or unavailable — ignore silently.
  }
}
