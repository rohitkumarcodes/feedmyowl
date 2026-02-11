import { normalizeFeedUrl } from "@/lib/feed-url";
import type {
  FeedImportEntry,
  FeedImportRowResult,
  FeedImportSourceType,
} from "@/lib/feed-import-types";

export interface ParsedImportFile {
  sourceType: FeedImportSourceType;
  entries: FeedImportEntry[];
}

export interface FeedImportRowSummary {
  processedCount: number;
  importedCount: number;
  duplicateCount: number;
  mergedCount: number;
  failedCount: number;
  skippedMultipleCount: number;
  failedDetails: string[];
}

function decodeXmlEntities(value: string): string {
  return value
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");
}

function parseTagAttributes(tag: string): Record<string, string> {
  const attributes: Record<string, string> = {};
  const attributePattern =
    /([^\s=/>]+)\s*=\s*("([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/g;

  for (const match of tag.matchAll(attributePattern)) {
    const name = (match[1] || "").toLowerCase();
    const rawValue = match[3] ?? match[4] ?? match[5] ?? "";
    attributes[name] = decodeXmlEntities(rawValue.trim());
  }

  return attributes;
}

function sanitizeFolderName(value: unknown): string {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim();
}

function sanitizeCustomTitle(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  return trimmed.slice(0, 255);
}

function normalizeOpmlFolderPath(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    return "";
  }

  const stripped = trimmed.replace(/^\/+|\/+$/g, "");
  if (!stripped) {
    return "";
  }

  const segments = stripped
    .split("/")
    .map((segment) => segment.trim())
    .filter((segment) => segment.length > 0);

  if (segments.length === 0) {
    return "";
  }

  return segments.join(" / ");
}

function parseOpmlCategoryFolderNames(value: string): string[] {
  return value
    .split(",")
    .map((category) => normalizeOpmlFolderPath(category))
    .filter((category) => category.length > 0);
}

/**
 * Parse feed entries from OPML/XML while preserving parent folder context.
 */
export function parseOpmlImportEntries(contents: string): FeedImportEntry[] {
  const entries: FeedImportEntry[] = [];
  const folderStack: string[] = [];
  const outlineContextStack: boolean[] = [];
  const outlineTagPattern = /<\/?outline\b[^>]*>/gi;

  for (const token of contents.matchAll(outlineTagPattern)) {
    const tag = token[0];
    const lowerTag = tag.toLowerCase();

    if (lowerTag.startsWith("</outline")) {
      const openedFolderContext = outlineContextStack.pop();
      if (openedFolderContext && folderStack.length > 0) {
        folderStack.pop();
      }
      continue;
    }

    const attributes = parseTagAttributes(tag);
    const xmlUrl = sanitizeFolderName(attributes.xmlurl);
    const label = sanitizeFolderName(attributes.text || attributes.title || "");
    const isSelfClosing = /\/\s*>$/.test(tag);

    if (xmlUrl) {
      const folderNames = new Set<string>();

      if (folderStack.length > 0) {
        folderNames.add(folderStack.join(" / "));
      }

      const categoryValue = sanitizeFolderName(attributes.category);
      if (categoryValue) {
        for (const categoryFolderName of parseOpmlCategoryFolderNames(categoryValue)) {
          folderNames.add(categoryFolderName);
        }
      }

      entries.push({
        url: xmlUrl,
        folderNames: [...folderNames],
        customTitle: sanitizeCustomTitle(label),
      });

      if (!isSelfClosing) {
        outlineContextStack.push(false);
      }

      continue;
    }

    if (!label) {
      if (!isSelfClosing) {
        outlineContextStack.push(false);
      }
      continue;
    }

    folderStack.push(label);
    if (!isSelfClosing) {
      outlineContextStack.push(true);
    } else {
      folderStack.pop();
    }
  }

  return entries;
}

/**
 * Parse FeedMyOwl JSON exports (portable v2 and legacy v1-compatible).
 */
export function parseJsonImportEntries(contents: string): FeedImportEntry[] {
  let parsed: unknown;

  try {
    parsed = JSON.parse(contents);
  } catch {
    throw new Error("This JSON file could not be parsed.");
  }

  if (!parsed || typeof parsed !== "object") {
    throw new Error("This JSON file does not contain feed export data.");
  }

  const root = parsed as Record<string, unknown>;
  const feedsValue = root.feeds;
  if (!Array.isArray(feedsValue)) {
    throw new Error("This JSON file does not contain a valid feeds array.");
  }

  const folderNameById = new Map<string, string>();
  const foldersValue = root.folders;
  if (Array.isArray(foldersValue)) {
    for (const folder of foldersValue) {
      if (!folder || typeof folder !== "object") {
        continue;
      }

      const id = (folder as Record<string, unknown>).id;
      const name = sanitizeFolderName((folder as Record<string, unknown>).name);
      if (typeof id !== "string" || !name) {
        continue;
      }
      folderNameById.set(id, name);
    }
  }

  const entries: FeedImportEntry[] = [];
  for (const feed of feedsValue) {
    if (!feed || typeof feed !== "object") {
      continue;
    }

    const candidate = feed as Record<string, unknown>;
    const rawUrl = sanitizeFolderName(candidate.url);
    if (!rawUrl) {
      continue;
    }

    const folderNames: string[] = [];

    if (Array.isArray(candidate.folders)) {
      for (const folderName of candidate.folders) {
        const normalized = sanitizeFolderName(folderName);
        if (normalized) {
          folderNames.push(normalized);
        }
      }
    } else {
      if (Array.isArray(candidate.folderIds)) {
        for (const folderId of candidate.folderIds) {
          if (typeof folderId !== "string") {
            continue;
          }

          const resolvedFolderName = folderNameById.get(folderId);
          if (resolvedFolderName) {
            folderNames.push(resolvedFolderName);
          }
        }
      }

      if (typeof candidate.folderId === "string") {
        const resolvedFolderName = folderNameById.get(candidate.folderId);
        if (resolvedFolderName) {
          folderNames.push(resolvedFolderName);
        }
      }
    }

    entries.push({
      url: rawUrl,
      folderNames,
      customTitle: sanitizeCustomTitle(candidate.customTitle),
    });
  }

  return entries;
}

/**
 * Normalize feed URLs and merge duplicate entries by URL.
 */
export function normalizeAndMergeImportEntries(entries: FeedImportEntry[]): FeedImportEntry[] {
  const mergedByUrl = new Map<string, FeedImportEntry>();
  const orderedUrls: string[] = [];

  for (const entry of entries) {
    const normalizedUrl = normalizeFeedUrl(entry.url);
    if (!normalizedUrl) {
      continue;
    }

    const folderNames = Array.isArray(entry.folderNames)
      ? entry.folderNames
          .map((folderName) => sanitizeFolderName(folderName))
          .filter((folderName) => folderName.length > 0)
      : [];
    const dedupedFolderNames = [...new Set(folderNames)];
    const customTitle = sanitizeCustomTitle(entry.customTitle);

    const existing = mergedByUrl.get(normalizedUrl);
    if (!existing) {
      mergedByUrl.set(normalizedUrl, {
        url: normalizedUrl,
        folderNames: dedupedFolderNames,
        customTitle,
      });
      orderedUrls.push(normalizedUrl);
      continue;
    }

    const nextFolderNames = [...new Set([...existing.folderNames, ...dedupedFolderNames])];
    mergedByUrl.set(normalizedUrl, {
      url: normalizedUrl,
      folderNames: nextFolderNames,
      customTitle: existing.customTitle || customTitle,
    });
  }

  return orderedUrls
    .map((url) => mergedByUrl.get(url))
    .filter((entry): entry is FeedImportEntry => Boolean(entry));
}

/**
 * Parse import file contents from extension-based source format.
 */
export function parseImportFileContents(fileName: string, contents: string): ParsedImportFile {
  const lowerName = fileName.toLowerCase();

  if (lowerName.endsWith(".json")) {
    return {
      sourceType: "JSON",
      entries: parseJsonImportEntries(contents),
    };
  }

  if (lowerName.endsWith(".opml") || lowerName.endsWith(".xml")) {
    return {
      sourceType: "OPML",
      entries: parseOpmlImportEntries(contents),
    };
  }

  throw new Error("Unsupported file type. Use .opml, .xml, or .json.");
}

export function chunkImportEntries(
  entries: FeedImportEntry[],
  chunkSize: number
): FeedImportEntry[][] {
  const normalizedChunkSize = Math.max(1, Math.floor(chunkSize));
  const chunks: FeedImportEntry[][] = [];

  for (let index = 0; index < entries.length; index += normalizedChunkSize) {
    chunks.push(entries.slice(index, index + normalizedChunkSize));
  }

  return chunks;
}

export function summarizeImportRows(
  rows: FeedImportRowResult[],
  maxFailureDetails = 8
): FeedImportRowSummary {
  const summary: FeedImportRowSummary = {
    processedCount: rows.length,
    importedCount: 0,
    duplicateCount: 0,
    mergedCount: 0,
    failedCount: 0,
    skippedMultipleCount: 0,
    failedDetails: [],
  };

  for (const row of rows) {
    if (row.status === "imported") {
      summary.importedCount += 1;
      continue;
    }

    if (row.status === "duplicate_merged") {
      summary.duplicateCount += 1;
      summary.mergedCount += 1;
      continue;
    }

    if (row.status === "duplicate_unchanged") {
      summary.duplicateCount += 1;
      continue;
    }

    summary.failedCount += 1;

    if (row.status === "skipped_multiple_candidates") {
      summary.skippedMultipleCount += 1;
    }

    if (summary.failedDetails.length < maxFailureDetails) {
      summary.failedDetails.push(`${row.url} — ${row.message || "Could not import."}`);
    }
  }

  return summary;
}
