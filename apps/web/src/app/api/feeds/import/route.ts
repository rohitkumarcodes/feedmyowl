import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { ensureUserRecord } from "@/lib/app-user";
import { handleApiRouteError } from "@/lib/api-errors";
import { assertTrustedWriteOrigin } from "@/lib/csrf";
import { captureMessage } from "@/lib/error-tracking";
import { importFeedEntriesForUser } from "@/lib/feed-import-service";
import { parseRequestJson } from "@/lib/http/request-json";
import { applyRouteRateLimit } from "@/lib/rate-limit";
import type {
  FeedImportEntry,
  FeedImportRequest,
  FeedImportResponse,
  FeedImportSourceType,
} from "@/lib/feed-import-types";
import { FEED_IMPORT_MAX_ENTRIES_PER_REQUEST } from "@/lib/feed-import-types";

function parseSourceType(value: unknown): FeedImportSourceType | null {
  return value === "OPML" || value === "JSON" ? value : null;
}

function parseImportEntries(value: unknown): FeedImportEntry[] | null {
  if (!Array.isArray(value)) {
    return null;
  }

  const entries: FeedImportEntry[] = [];
  for (const row of value) {
    if (!row || typeof row !== "object") {
      return null;
    }

    const candidate = row as Record<string, unknown>;
    const url = candidate.url;
    const folderNames = candidate.folderNames;
    const customTitle = candidate.customTitle;

    if (typeof url !== "string") {
      return null;
    }

    if (!Array.isArray(folderNames) || !folderNames.every((name) => typeof name === "string")) {
      return null;
    }

    if (
      customTitle !== null &&
      customTitle !== undefined &&
      typeof customTitle !== "string"
    ) {
      return null;
    }

    entries.push({
      url,
      folderNames,
      customTitle: customTitle ?? null,
    });
  }

  return entries;
}

/**
 * POST /api/feeds/import
 * Chunked feed import endpoint used by settings import workflow.
 */
export async function POST(request: NextRequest) {
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

    const payload = await parseRequestJson(request);
    if (!payload) {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const sourceType = parseSourceType(payload.sourceType);
    if (!sourceType) {
      return NextResponse.json(
        { error: "sourceType must be either OPML or JSON." },
        { status: 400 }
      );
    }

    const entries = parseImportEntries(payload.entries);
    if (!entries) {
      return NextResponse.json(
        {
          error:
            "entries must be an array of { url, folderNames, customTitle } objects.",
        },
        { status: 400 }
      );
    }

    if (entries.length > FEED_IMPORT_MAX_ENTRIES_PER_REQUEST) {
      return NextResponse.json(
        {
          error: `A single import request can process at most ${FEED_IMPORT_MAX_ENTRIES_PER_REQUEST} entries.`,
        },
        { status: 400 }
      );
    }

    const optionsValue = payload.options;
    const skipMultiCandidate =
      !optionsValue ||
      typeof optionsValue !== "object" ||
      (optionsValue as FeedImportRequest["options"] | null)?.skipMultiCandidate !==
        false;

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
          row.status === "duplicate_merged" || row.status === "duplicate_unchanged"
      ).length,
      mergedCount: rows.filter((row) => row.status === "duplicate_merged").length,
      failedCount: rows.filter(
        (row) =>
          row.status === "failed" || row.status === "skipped_multiple_candidates"
      ).length,
      rows,
    };

    const failureCounts: Record<string, number> = {};
    for (const row of rows) {
      if (!row.code) {
        continue;
      }
      failureCounts[row.code] = (failureCounts[row.code] || 0) + 1;
    }

    captureMessage(
      `feeds.import.summary source=${sourceType} processed=${responseBody.processedCount} imported=${responseBody.importedCount} duplicates=${responseBody.duplicateCount} merged=${responseBody.mergedCount} failed=${responseBody.failedCount} codes=${JSON.stringify(
        failureCounts
      )}`
    );

    return NextResponse.json(responseBody);
  } catch (error) {
    return handleApiRouteError(error, "api.feeds.import.post");
  }
}
