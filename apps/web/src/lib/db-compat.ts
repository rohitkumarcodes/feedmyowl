/**
 * Helpers for temporary schema compatibility during rolling migrations.
 */

interface DbErrorLike {
  code?: string;
  message?: string;
}

/**
 * Detect "relation does not exist" errors for one table.
 */
export function isMissingRelationError(
  error: unknown,
  relationName: string
): boolean {
  if (!error || typeof error !== "object") {
    return false;
  }

  const candidate = error as DbErrorLike;
  if (candidate.code !== "42P01") {
    return false;
  }

  const message = candidate.message || "";
  return message.includes(`"${relationName}"`) || message.includes(relationName);
}

/**
 * Detect "column does not exist" errors for one column.
 */
export function isMissingColumnError(error: unknown, columnName: string): boolean {
  if (!error || typeof error !== "object") {
    return false;
  }

  const candidate = error as DbErrorLike;
  if (candidate.code !== "42703") {
    return false;
  }

  const message = candidate.message || "";
  return message.includes(`"${columnName}"`) || message.includes(columnName);
}
