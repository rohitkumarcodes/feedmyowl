/**
 * Reading Mode — shared type and validation helpers.
 *
 * FeedMyOwl supports two reading modes:
 *   - "reader" (default): calm, archival experience.  No unread counts,
 *     no badges, no urgency.  All articles look the same.
 *   - "checker": traditional RSS experience.  Unread counts on folders
 *     and feeds, an "Unread" virtual scope in the sidebar, visual
 *     read/unread distinction, "Mark all as read" actions, and a
 *     post-refresh "N new articles" notification.
 *
 * readAt is silently tracked in both modes so switching modes shows
 * accurate state immediately.
 */

export const READING_MODE_VALUES = ["reader", "checker"] as const;

export type ReadingMode = (typeof READING_MODE_VALUES)[number];

export const DEFAULT_READING_MODE: ReadingMode = "reader";

const readingModeSet = new Set<string>(READING_MODE_VALUES);

/**
 * Type guard: returns true if `value` is a valid ReadingMode string.
 */
export function isReadingMode(value: string): value is ReadingMode {
  return readingModeSet.has(value);
}

/**
 * Safely coerce an unknown value to a ReadingMode.
 * Falls back to DEFAULT_READING_MODE when the value is invalid.
 */
export function coerceReadingMode(value: unknown): ReadingMode {
  if (typeof value === "string" && isReadingMode(value)) {
    return value;
  }

  return DEFAULT_READING_MODE;
}
