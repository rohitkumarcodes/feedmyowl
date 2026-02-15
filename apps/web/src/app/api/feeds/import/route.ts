import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/server/auth";
import { ensureUserRecord } from "@/lib/server/app-user";
import { handleApiRouteError } from "@/lib/server/api-errors";
import { assertTrustedWriteOrigin } from "@/lib/server/csrf";
import { captureMessage } from "@/lib/server/error-tracking";
import { importFeedEntriesForUser } from "@/lib/server/feed-import-service";
import { parseRequestJsonWithLimit } from "@/lib/server/http/request-json";
import { applyRouteRateLimit } from "@/lib/server/rate-limit";
import type {
  FeedImportEntry,
  FeedImportRequest,
  FeedImportResponse,
  FeedImportSourceType,
} from "@/lib/shared/feed-import-types";
import { FEED_IMPORT_MAX_ENTRIES_PER_REQUEST } from "@/lib/shared/feed-import-types";
import {
  FEED_IMPORT_MAX_CUSTOM_TITLE_LENGTH,
  FEED_IMPORT_MAX_FOLDER_NAMES_PER_ENTRY,
  FEED_IMPORT_MAX_REQUEST_BYTES,
  FEED_IMPORT_MAX_URL_LENGTH,
} from "@/lib/shared/feed-import-types";
import { FOLDER_NAME_MAX_LENGTH } from "@/lib/server/folder-service";

function parseSourceType(value: unknown): FeedImportSourceType | null {
  return value === "OPML" || value === "JSON" ? value : null;
}

type ParseImportEntriesResult =
  | { status: "ok"; entries: FeedImportEntry[] }
  | { status: "invalid_payload"; error: string };

function parseImportEntries(value: unknown): ParseImportEntriesResult {
  if (!Array.isArray(value)) {
    return {
      status: "invalid_payload",
      error: "entries must be an array of { url, folderNames, customTitle } objects.",
    };
  }

  if (value.length === 0) {
    return {
      status: "invalid_payload",
      error: "entries must include at least one entry.",
    };
  }

  const entries: FeedImportEntry[] = [];
  for (const [index, row] of value.entries()) {
    if (!row || typeof row !== "object") {
      return {
        status: "invalid_payload",
        error: `entries[${index}] must be an object.`,
      };
    }

    const candidate = row as Record<string, unknown>;
    const url = candidate.url;
    const folderNames = candidate.folderNames;
    const customTitle = candidate.customTitle;

    if (typeof url !== "string" || !url.trim()) {
      return {
        status: "invalid_payload",
        error: `entries[${index}].url must be a non-empty string.`,
      };
    }

    if (url.length > FEED_IMPORT_MAX_URL_LENGTH) {
      return {
        status: "invalid_payload",
        error: `entries[${index}].url must be at most ${FEED_IMPORT_MAX_URL_LENGTH} characters.`,
      };
    }

    if (
      !Array.isArray(folderNames) ||
      !folderNames.every((name) => typeof name === "string")
    ) {
      return {
        status: "invalid_payload",
        error: `entries[${index}].folderNames must be an array of strings.`,
      };
    }

    if (folderNames.length > FEED_IMPORT_MAX_FOLDER_NAMES_PER_ENTRY) {
      return {
        status: "invalid_payload",
        error: `entries[${index}].folderNames can include at most ${FEED_IMPORT_MAX_FOLDER_NAMES_PER_ENTRY} items.`,
      };
    }

    if (folderNames.some((folderName) => folderName.length > FOLDER_NAME_MAX_LENGTH)) {
      return {
        status: "invalid_payload",
        error: `entries[${index}].folderNames entries must each be at most ${FOLDER_NAME_MAX_LENGTH} characters.`,
      };
    }

    if (
      customTitle !== null &&
      customTitle !== undefined &&
      typeof customTitle !== "string"
    ) {
      return {
        status: "invalid_payload",
        error: `entries[${index}].customTitle must be a string or null.`,
      };
    }

    if (
      typeof customTitle === "string" &&
      customTitle.length > FEED_IMPORT_MAX_CUSTOM_TITLE_LENGTH
    ) {
      return {
        status: "invalid_payload",
        error: `entries[${index}].customTitle must be at most ${FEED_IMPORT_MAX_CUSTOM_TITLE_LENGTH} characters.`,
      };
    }

    entries.push({
      url,
      folderNames,
      customTitle: customTitle ?? null,
    });
  }

  return {
    status: "ok",
    entries,
  };
}

function badRequest(code: "invalid_payload" | "entry_limit_exceeded", error: string) {
  return NextResponse.json(
    {
      error,
      code,
    },
    { status: 400 },
  );
}

/**
 * POST /api/feeds/import
 * Chunked feed import endpoint used by settings import workflow.
 */
export async function POST(request: NextRequest) {
  const startedAtMs = Date.now();

  try {
    const csrfFailure = assertTrustedWriteOrigin(request, "api.feeds.import.post");
    if (csrfFailure) {
      return csrfFailure;
    }

    const { clerkId } = await requireAuth();
    const appUser = await ensureUserRecord(clerkId);

    if (!appUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const rateLimit = await applyRouteRateLimit({
      request,
      routeKey: "api_feeds_import_post",
      userId: appUser.id,
      userLimitPerMinute: 25,
      ipLimitPerMinute: 100,
    });

    if (!rateLimit.allowed) {
      return rateLimit.response;
    }

    const payloadResult = await parseRequestJsonWithLimit(request, {
      maxBytes: FEED_IMPORT_MAX_REQUEST_BYTES,
    });
    if (payloadResult.status === "payload_too_large") {
      captureMessage(
        `feeds.import.rejected route=api.feeds.import.post reason=payload_too_large max_bytes=${FEED_IMPORT_MAX_REQUEST_BYTES}`,
        "warning",
      );
      return NextResponse.json(
        {
          error: `Request payload exceeds ${FEED_IMPORT_MAX_REQUEST_BYTES} bytes.`,
          code: "payload_too_large",
        },
        { status: 413 },
      );
    }

    if (payloadResult.status !== "ok") {
      return badRequest("invalid_payload", "Invalid JSON body.");
    }
    const payload = payloadResult.payload;

    const sourceType = parseSourceType(payload.sourceType);
    if (!sourceType) {
      return badRequest("invalid_payload", "sourceType must be either OPML or JSON.");
    }

    const entriesResult = parseImportEntries(payload.entries);
    if (entriesResult.status !== "ok") {
      return badRequest("invalid_payload", entriesResult.error);
    }
    const entries = entriesResult.entries;

    if (entries.length > FEED_IMPORT_MAX_ENTRIES_PER_REQUEST) {
      return badRequest(
        "entry_limit_exceeded",
        `A single import request can process at most ${FEED_IMPORT_MAX_ENTRIES_PER_REQUEST} entries.`,
      );
    }

    const optionsValue = payload.options;
    const skipMultiCandidate =
      !optionsValue ||
      typeof optionsValue !== "object" ||
      (optionsValue as FeedImportRequest["options"] | null)?.skipMultiCandidate !== false;

    const rows = await importFeedEntriesForUser({
      userId: appUser.id,
      entries,
      skipMultiCandidate,
    });

    const responseBody: FeedImportResponse = {
      processedCount: rows.length,
      importedCount: rows.filter((row) => row.status === "imported").length,
      duplicateCount: rows.filter(
        (row) =>
          row.status === "duplicate_merged" || row.status === "duplicate_unchanged",
      ).length,
      mergedCount: rows.filter((row) => row.status === "duplicate_merged").length,
      failedCount: rows.filter(
        (row) => row.status === "failed" || row.status === "skipped_multiple_candidates",
      ).length,
      rows,
    };
    const warningCount = rows.reduce(
      (total, row) => total + (row.warnings?.length ?? 0),
      0,
    );

    const failureCounts: Record<string, number> = {};
    for (const row of rows) {
      if (!row.code) {
        continue;
      }
      failureCounts[row.code] = (failureCounts[row.code] || 0) + 1;
    }

    captureMessage(
      `feeds.import.completed route=api.feeds.import.post source=${sourceType} processed=${responseBody.processedCount} imported=${responseBody.importedCount} duplicates=${responseBody.duplicateCount} merged=${responseBody.mergedCount} failed=${responseBody.failedCount} warnings=${warningCount} duration_ms=${Date.now() - startedAtMs} codes=${JSON.stringify(
        failureCounts,
      )}`,
    );

    return NextResponse.json(responseBody);
  } catch (error) {
    return handleApiRouteError(error, "api.feeds.import.post");
  }
}
