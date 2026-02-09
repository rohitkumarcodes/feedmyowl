export type BulkAddRowStatus = "imported" | "duplicate" | "failed";

export interface BulkSummaryRow {
  url: string;
  status: BulkAddRowStatus;
  message?: string;
}

export interface BulkSummary {
  processedCount: number;
  importedCount: number;
  duplicateCount: number;
  failedCount: number;
  failedDetails: string[];
}

/**
 * Parse newline-separated feed URLs from the bulk add textarea.
 */
export function parseBulkFeedLines(value: string): string[] {
  return value
    .split(/\r?\n/g)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

/**
 * Remove exact duplicate entries while preserving first-seen order.
 */
export function dedupeBulkFeedLines(lines: string[]): string[] {
  const seen = new Set<string>();
  const deduped: string[] = [];

  for (const line of lines) {
    if (seen.has(line)) {
      continue;
    }

    seen.add(line);
    deduped.push(line);
  }

  return deduped;
}

/**
 * Build summary counts and top failure details for bulk add results.
 */
export function summarizeBulkAddRows(
  rows: BulkSummaryRow[],
  maxFailureDetails = 5
): BulkSummary {
  const summary: BulkSummary = {
    processedCount: rows.length,
    importedCount: 0,
    duplicateCount: 0,
    failedCount: 0,
    failedDetails: [],
  };

  for (const row of rows) {
    if (row.status === "imported") {
      summary.importedCount += 1;
      continue;
    }

    if (row.status === "duplicate") {
      summary.duplicateCount += 1;
      continue;
    }

    summary.failedCount += 1;
    if (summary.failedDetails.length < maxFailureDetails) {
      summary.failedDetails.push(`${row.url} — ${row.message || "Could not import."}`);
    }
  }

  return summary;
}
