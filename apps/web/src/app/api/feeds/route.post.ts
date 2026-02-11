import { NextRequest, NextResponse } from "next/server";
import {
  and,
  db,
  eq,
  folders,
  inArray,
} from "@/lib/database";
import { handleApiRouteError } from "@/lib/api-errors";
import { assertTrustedWriteOrigin } from "@/lib/csrf";
import {
  discoverFeedCandidates,
  type FeedDiscoveryMethod,
} from "@/lib/feed-discovery";
import { normalizeFeedError } from "@/lib/feed-errors";
import { fetchFeedXml } from "@/lib/feed-fetcher";
import {
  parseFeed,
  parseFeedWithMetadata,
  parseFeedXml,
  type ParsedFeed,
} from "@/lib/feed-parser";
import { normalizeFeedUrl } from "@/lib/feed-url";
import { applyRouteRateLimit } from "@/lib/rate-limit";
import {
  createFeedWithInitialItems,
  findExistingFeedForUserByUrl,
} from "@/lib/feed-service";
import { normalizeFolderIds } from "@/lib/folder-memberships";
import { getFeedFolderIdsForUserFeed } from "@/lib/feed-folder-memberships";
import { NO_FEED_FOUND_MESSAGE } from "@/lib/feed-messages";
import type { ApiError } from "./route.shared";
import { getAppUser, parseRouteJson } from "./route.shared";

type DiscoveryCandidateMethod = "direct" | FeedDiscoveryMethod;

interface DiscoverCandidateResponse {
  url: string;
  title: string | null;
  method: DiscoveryCandidateMethod;
  duplicate: boolean;
  existingFeedId: string | null;
}

interface ValidatedDiscoverCandidate extends DiscoverCandidateResponse {
  parsedFeed: ParsedFeed;
}

interface CandidateXmlFetchResult {
  xml: string;
  etag: string | null;
  lastModified: string | null;
  finalUrl: string;
}

const FEED_CANDIDATE_TIMEOUT_MS = 7_000;

function toDiscoverCandidateResponse(
  candidate: ValidatedDiscoverCandidate
): DiscoverCandidateResponse {
  return {
    url: candidate.url,
    title: candidate.title,
    method: candidate.method,
    duplicate: candidate.duplicate,
    existingFeedId: candidate.existingFeedId,
  };
}

async function fetchFeedCandidateXml(url: string): Promise<CandidateXmlFetchResult> {
  const response = await fetchFeedXml(url, {
    timeoutMs: FEED_CANDIDATE_TIMEOUT_MS,
    retries: 0,
    maxRedirects: 5,
  });

  if (response.status !== "ok") {
    throw new Error("Feed candidate request unexpectedly returned not-modified");
  }

  return {
    xml: response.text ?? "",
    etag: response.etag,
    lastModified: response.lastModified,
    finalUrl: response.finalUrl,
  };
}

async function buildValidatedCandidateForUser(params: {
  userId: string;
  candidateUrl: string;
  method: DiscoveryCandidateMethod;
  parsedFeed: ParsedFeed;
}): Promise<ValidatedDiscoverCandidate> {
  const existingFeed = await findExistingFeedForUserByUrl(
    params.userId,
    params.candidateUrl
  );

  return {
    url: params.candidateUrl,
    title: params.parsedFeed.title ?? null,
    method: params.method,
    duplicate: Boolean(existingFeed),
    existingFeedId: existingFeed?.id ?? null,
    parsedFeed: params.parsedFeed,
  };
}

async function validateCandidateXmlForUser(params: {
  userId: string;
  candidateUrl: string;
  method: FeedDiscoveryMethod;
}): Promise<ValidatedDiscoverCandidate | null> {
  try {
    const candidateResponse = await fetchFeedCandidateXml(params.candidateUrl);
    const parsedFeed = await parseFeedXml(candidateResponse.xml);

    return await buildValidatedCandidateForUser({
      userId: params.userId,
      candidateUrl: candidateResponse.finalUrl,
      method: params.method,
      parsedFeed,
    });
  } catch {
    return null;
  }
}

function parseFolderIdsPayload(payload: Record<string, unknown>): string[] | null {
  const rawFolderIds = payload.folderIds;

  if (rawFolderIds === undefined) {
    return [];
  }

  if (!Array.isArray(rawFolderIds)) {
    return null;
  }

  if (!rawFolderIds.every((value) => typeof value === "string")) {
    return null;
  }

  return normalizeFolderIds(rawFolderIds);
}

/**
 * POST /api/feeds
 *
 * Supported actions:
 *   - feed.discover
 *   - feed.create
 */
export async function postFeedsRoute(request: NextRequest) {
  try {
    const csrfFailure = assertTrustedWriteOrigin(request, "api.feeds.post");
    if (csrfFailure) {
      return csrfFailure;
    }

    const appUser = await getAppUser();

    if (!appUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const rateLimit = await applyRouteRateLimit({
      request,
      routeKey: "api_feeds_post",
      userId: appUser.id,
      userLimitPerMinute: 20,
      ipLimitPerMinute: 60,
    });

    if (!rateLimit.allowed) {
      return rateLimit.response;
    }

    const payload = await parseRouteJson(request);
    if (!payload) {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const action = payload.action;

    if (typeof action !== "string") {
      return NextResponse.json({ error: "Action is required" }, { status: 400 });
    }

    if (action !== "feed.discover" && action !== "feed.create") {
      return NextResponse.json({ error: "Unsupported action" }, { status: 400 });
    }

    const nextUrl = normalizeFeedUrl(payload.url);
    if (!nextUrl) {
      return NextResponse.json(
        {
          error: "This URL does not appear to be valid.",
          code: "invalid_url",
        } satisfies ApiError,
        { status: 400 }
      );
    }

    if (action === "feed.discover") {
      const validatedCandidates: ValidatedDiscoverCandidate[] = [];
      const seenCandidateUrls = new Set<string>();

      try {
        const parsedDirectFeed = await parseFeed(nextUrl);
        const directCandidate = await buildValidatedCandidateForUser({
          userId: appUser.id,
          candidateUrl: nextUrl,
          method: "direct",
          parsedFeed: parsedDirectFeed,
        });

        validatedCandidates.push(directCandidate);
        seenCandidateUrls.add(directCandidate.url);
      } catch (error) {
        const normalizedError = normalizeFeedError(error, "create");

        if (normalizedError.code !== "invalid_xml") {
          return NextResponse.json(
            {
              error: normalizedError.message,
              code: normalizedError.code,
            } satisfies ApiError,
            { status: 400 }
          );
        }
      }

      const discovery = await discoverFeedCandidates(nextUrl);
      for (const candidateUrl of discovery.candidates) {
        if (seenCandidateUrls.has(candidateUrl)) {
          continue;
        }

        const method = discovery.methodHints[candidateUrl] ?? "heuristic_path";
        const validatedCandidate = await validateCandidateXmlForUser({
          userId: appUser.id,
          candidateUrl,
          method,
        });

        if (!validatedCandidate) {
          continue;
        }

        seenCandidateUrls.add(validatedCandidate.url);
        validatedCandidates.push(validatedCandidate);
      }

      if (validatedCandidates.length === 0) {
        return NextResponse.json(
          {
            error: NO_FEED_FOUND_MESSAGE,
            code: "invalid_xml",
          } satisfies ApiError,
          { status: 400 }
        );
      }

      const addableCandidates = validatedCandidates.filter(
        (candidate) => !candidate.duplicate
      );
      const status =
        addableCandidates.length === 0
          ? "duplicate"
          : addableCandidates.length === 1
            ? "single"
            : "multiple";

      return NextResponse.json({
        status,
        normalizedInputUrl: nextUrl,
        candidates: validatedCandidates.map(toDiscoverCandidateResponse),
      });
    }

    const requestedFolderIds = parseFolderIdsPayload(payload);
    if (!requestedFolderIds) {
      return NextResponse.json(
        {
          error: "folderIds must be an array of folder IDs.",
          code: "invalid_folder_ids",
        } satisfies ApiError,
        { status: 400 }
      );
    }

    if (requestedFolderIds.length > 0) {
      const existingFolders = await db.query.folders.findMany({
        where: and(
          eq(folders.userId, appUser.id),
          inArray(folders.id, requestedFolderIds)
        ),
        columns: { id: true },
      });
      const existingFolderIds = new Set(existingFolders.map((folder) => folder.id));
      const invalidFolderIds = requestedFolderIds.filter(
        (folderId) => !existingFolderIds.has(folderId)
      );

      if (invalidFolderIds.length > 0) {
        return NextResponse.json(
          {
            error: "One or more selected folders could not be found.",
            code: "invalid_folder_ids",
          } satisfies ApiError,
          { status: 400 }
        );
      }
    }

    const existingFeed = await findExistingFeedForUserByUrl(appUser.id, nextUrl);

    if (existingFeed) {
      const existingFeedFolderIds = await getFeedFolderIdsForUserFeed(
        appUser.id,
        existingFeed.id
      );

      return NextResponse.json({
        feed: {
          ...existingFeed,
          folderIds: existingFeedFolderIds,
        },
        duplicate: true,
        message: "This feed is already in your library.",
      });
    }

    let parsedFeed: ParsedFeed | null = null;
    let resolvedUrl = nextUrl;
    let resolvedEtag: string | null = null;
    let resolvedLastModified: string | null = null;
    let discoveredFromSiteUrl = false;

    try {
      const parsedDirect = await parseFeedWithMetadata(nextUrl);
      parsedFeed = parsedDirect.parsedFeed;
      resolvedEtag = parsedDirect.etag;
      resolvedLastModified = parsedDirect.lastModified;
      resolvedUrl = parsedDirect.resolvedUrl;
    } catch (error) {
      const normalizedError = normalizeFeedError(error, "create");

      if (normalizedError.code !== "invalid_xml") {
        return NextResponse.json(
          {
            error: normalizedError.message,
            code: normalizedError.code,
          } satisfies ApiError,
          { status: 400 }
        );
      }

      const discovery = await discoverFeedCandidates(nextUrl);

      for (const candidateUrl of discovery.candidates) {
        const duplicateFeed = await findExistingFeedForUserByUrl(appUser.id, candidateUrl);

        if (duplicateFeed) {
          const duplicateFeedFolderIds = await getFeedFolderIdsForUserFeed(
            appUser.id,
            duplicateFeed.id
          );

          return NextResponse.json({
            feed: {
              ...duplicateFeed,
              folderIds: duplicateFeedFolderIds,
            },
            duplicate: true,
            message: "This feed is already in your library.",
          });
        }

        try {
          const candidateResponse = await fetchFeedCandidateXml(candidateUrl);
          parsedFeed = await parseFeedXml(candidateResponse.xml);
          resolvedUrl = candidateResponse.finalUrl;
          resolvedEtag = candidateResponse.etag;
          resolvedLastModified = candidateResponse.lastModified;
          discoveredFromSiteUrl = true;

          const resolvedDuplicate = await findExistingFeedForUserByUrl(
            appUser.id,
            resolvedUrl
          );

          if (resolvedDuplicate) {
            const duplicateFeedFolderIds = await getFeedFolderIdsForUserFeed(
              appUser.id,
              resolvedDuplicate.id
            );

            return NextResponse.json({
              feed: {
                ...resolvedDuplicate,
                folderIds: duplicateFeedFolderIds,
              },
              duplicate: true,
              message: "This feed is already in your library.",
            });
          }

          break;
        } catch {
          // Keep trying additional candidates.
        }
      }

      if (!parsedFeed) {
        return NextResponse.json(
          {
            error: NO_FEED_FOUND_MESSAGE,
            code: "invalid_xml",
          } satisfies ApiError,
          { status: 400 }
        );
      }
    }

    if (!parsedFeed) {
      return NextResponse.json(
        { error: "Could not add this feed right now." },
        { status: 500 }
      );
    }

    let created: Awaited<ReturnType<typeof createFeedWithInitialItems>> | null = null;
    try {
      created = await createFeedWithInitialItems(
        appUser.id,
        resolvedUrl,
        parsedFeed,
        requestedFolderIds,
        {
          etag: resolvedEtag,
          lastModified: resolvedLastModified,
        }
      );
    } catch {
      const raceExistingFeed = await findExistingFeedForUserByUrl(appUser.id, resolvedUrl);

      if (raceExistingFeed) {
        const raceFeedFolderIds = await getFeedFolderIdsForUserFeed(
          appUser.id,
          raceExistingFeed.id
        );

        return NextResponse.json({
          feed: {
            ...raceExistingFeed,
            folderIds: raceFeedFolderIds,
          },
          duplicate: true,
          message: "This feed is already in your library.",
        });
      }

      return NextResponse.json(
        { error: "Could not add this feed right now." },
        { status: 500 }
      );
    }

    if (!created) {
      return NextResponse.json(
        { error: "Could not add this feed right now." },
        { status: 500 }
      );
    }

    const createdFolderIds = await getFeedFolderIdsForUserFeed(
      appUser.id,
      created.feed.id
    );

    return NextResponse.json(
      {
        feed: {
          ...created.feed,
          folderIds: createdFolderIds,
        },
        importedItemCount: created.insertedItems,
        duplicate: false,
        message: discoveredFromSiteUrl
          ? "Feed found automatically and added."
          : undefined,
      },
      { status: 201 }
    );
  } catch (error) {
    return handleApiRouteError(error, "api.feeds.post");
  }
}
