/**
 * API Route: /api/feeds
 *
 * Handles feed creation, article read actions, and account deletion
 * for the authenticated user while keeping the surface area minimal.
 */

import { NextRequest, NextResponse } from "next/server";
import {
  and,
  db,
  eq,
  feedFolderMemberships,
  folders,
  inArray,
  users,
} from "@/lib/database";
import { deleteAuthUser, requireAuth } from "@/lib/auth";
import { handleApiRouteError } from "@/lib/api-errors";
import { ensureUserRecord } from "@/lib/app-user";
import { isMissingRelationError } from "@/lib/db-compat";
import { assertTrustedWriteOrigin } from "@/lib/csrf";
import {
  discoverFeedCandidates,
  type FeedDiscoveryMethod,
} from "@/lib/feed-discovery";
import {
  parseFeed,
  parseFeedWithMetadata,
  parseFeedXml,
  type ParsedFeed,
} from "@/lib/feed-parser";
import { fetchFeedXml } from "@/lib/feed-fetcher";
import { purgeOldFeedItemsForUser } from "@/lib/retention";
import { normalizeFeedError } from "@/lib/feed-errors";
import { normalizeFeedUrl } from "@/lib/feed-url";
import { applyRouteRateLimit } from "@/lib/rate-limit";
import {
  normalizeFolderIds,
  resolveFeedFolderIds,
} from "@/lib/folder-memberships";
import {
  createFeedWithInitialItems,
  findExistingFeedForUserByUrl,
  markFeedItemReadForUser,
} from "@/lib/feed-service";

interface ApiError {
  error: string;
  code?: string;
}

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
const NO_FEED_FOUND_MESSAGE =
  "Error: We couldn't find any feed at this URL. Contact site owner and ask for the feed link.";

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

/**
 * Safely parse JSON request bodies and return null for invalid JSON.
 */
async function parseRequestJson(
  request: NextRequest
): Promise<Record<string, unknown> | null> {
  try {
    return (await request.json()) as Record<string, unknown>;
  } catch {
    return null;
  }
}

/**
 * Resolve the currently authenticated application user row.
 */
async function getAppUser() {
  const { clerkId } = await requireAuth();
  return await ensureUserRecord(clerkId);
}

/**
 * Parse optional folderIds payload for feed.create.
 */
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
 * Resolve one feed's folder ids with transitional legacy fallback.
 */
async function getFeedFolderIds(params: {
  userId: string;
  feedId: string;
  legacyFolderId: string | null;
}): Promise<string[]> {
  let memberships: Array<{ folderId: string }> = [];

  try {
    memberships = await db.query.feedFolderMemberships.findMany({
      where: and(
        eq(feedFolderMemberships.userId, params.userId),
        eq(feedFolderMemberships.feedId, params.feedId)
      ),
      columns: { folderId: true },
    });
  } catch (error) {
    if (!isMissingRelationError(error, "feed_folder_memberships")) {
      throw error;
    }
  }

  return resolveFeedFolderIds({
    legacyFolderId: params.legacyFolderId,
    membershipFolderIds: memberships.map((membership) => membership.folderId),
  });
}

function getMembershipFolderIds(feed: unknown): string[] {
  const candidate = feed as { folderMemberships?: Array<{ folderId: string }> };
  if (!Array.isArray(candidate.folderMemberships)) {
    return [];
  }

  return candidate.folderMemberships.map((membership) => membership.folderId);
}

/**
 * GET /api/feeds
 * Returns feeds for the authenticated user.
 */
export async function GET() {
  try {
    const appUser = await getAppUser();

    if (!appUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Keep 50-items-per-feed cap enforced even during read-heavy sessions.
    await purgeOldFeedItemsForUser(appUser.id);

    let user: Record<string, unknown> | null = null;

    try {
      user = (await db.query.users.findFirst({
        where: eq(users.id, appUser.id),
        columns: {
          id: true,
          clerkId: true,
          email: true,
          subscriptionTier: true,
          stripeCustomerId: true,
          stripeSubscriptionId: true,
          createdAt: true,
          updatedAt: true,
        },
        with: {
          folders: true,
          feeds: {
            with: {
              items: true,
              folderMemberships: {
                columns: {
                  folderId: true,
                },
              },
            },
          },
        },
      })) as Record<string, unknown> | null;
    } catch (error) {
      if (!isMissingRelationError(error, "feed_folder_memberships")) {
        throw error;
      }

      user = (await db.query.users.findFirst({
        where: eq(users.id, appUser.id),
        columns: {
          id: true,
          clerkId: true,
          email: true,
          subscriptionTier: true,
          stripeCustomerId: true,
          stripeSubscriptionId: true,
          createdAt: true,
          updatedAt: true,
        },
        with: {
          folders: true,
          feeds: {
            with: {
              items: true,
            },
          },
        },
      })) as Record<string, unknown> | null;
    }

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const folderRows =
      (user.folders as
        | Array<{
            id: string;
            name: string;
            createdAt: Date;
            updatedAt: Date;
          }>
        | undefined) ?? [];

    const feedRows =
      (user.feeds as
        | Array<{
            id: string;
            userId: string;
            folderId: string | null;
            url: string;
            title: string | null;
            customTitle: string | null;
            description: string | null;
            lastFetchedAt: Date | null;
            lastFetchStatus: string | null;
            lastFetchErrorCode: string | null;
            lastFetchErrorMessage: string | null;
            lastFetchErrorAt: Date | null;
            createdAt: Date;
            updatedAt: Date;
            items: Array<{
              id: string;
              feedId: string;
              guid: string | null;
              title: string | null;
              link: string | null;
              content: string | null;
              author: string | null;
              publishedAt: Date | null;
              readAt: Date | null;
              createdAt: Date;
              updatedAt: Date;
            }>;
            folderMemberships?: Array<{ folderId: string }>;
          }>
        | undefined) ?? [];

    const responseFeeds = feedRows.map((feed) => ({
      id: feed.id,
      userId: feed.userId,
      folderId: feed.folderId,
      url: feed.url,
      title: feed.title,
      customTitle: feed.customTitle,
      description: feed.description,
      lastFetchedAt: feed.lastFetchedAt,
      lastFetchStatus: feed.lastFetchStatus,
      lastFetchErrorCode: feed.lastFetchErrorCode,
      lastFetchErrorMessage: feed.lastFetchErrorMessage,
      lastFetchErrorAt: feed.lastFetchErrorAt,
      createdAt: feed.createdAt,
      updatedAt: feed.updatedAt,
      items: feed.items,
      folderIds: resolveFeedFolderIds({
        legacyFolderId: feed.folderId,
        membershipFolderIds: getMembershipFolderIds(feed),
      }),
    }));

    return NextResponse.json({ feeds: responseFeeds, folders: folderRows });
  } catch (error) {
    return handleApiRouteError(error, "api.feeds.get");
  }
}

/**
 * POST /api/feeds
 *
 * Supported actions:
 *   - feed.discover
 *   - feed.create (and legacy { url } payload)
 */
export async function POST(request: NextRequest) {
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

    const payload = await parseRequestJson(request);
    if (!payload) {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const rawAction = payload.action;

    // Backward compatibility: when action is omitted but `url` exists,
    // treat it as feed.create.
    const action =
      typeof rawAction === "string"
        ? rawAction
        : typeof payload.url === "string"
          ? "feed.create"
          : null;

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
      const existingFeedFolderIds = await getFeedFolderIds({
        userId: appUser.id,
        feedId: existingFeed.id,
        legacyFolderId: existingFeed.folderId,
      });

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
          const duplicateFeedFolderIds = await getFeedFolderIds({
            userId: appUser.id,
            feedId: duplicateFeed.id,
            legacyFolderId: duplicateFeed.folderId,
          });

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
            const duplicateFeedFolderIds = await getFeedFolderIds({
              userId: appUser.id,
              feedId: resolvedDuplicate.id,
              legacyFolderId: resolvedDuplicate.folderId,
            });

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
        const raceFeedFolderIds = await getFeedFolderIds({
          userId: appUser.id,
          feedId: raceExistingFeed.id,
          legacyFolderId: raceExistingFeed.folderId,
        });

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

    const createdFolderIds = await getFeedFolderIds({
      userId: appUser.id,
      feedId: created.feed.id,
      legacyFolderId: created.feed.folderId,
    });

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

/**
 * PATCH /api/feeds
 *
 * Supported actions:
 *   - item.markRead
 *   - account.delete
 */
export async function PATCH(request: NextRequest) {
  try {
    const csrfFailure = assertTrustedWriteOrigin(request, "api.feeds.patch");
    if (csrfFailure) {
      return csrfFailure;
    }

    const appUser = await getAppUser();

    if (!appUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const payload = await parseRequestJson(request);
    if (!payload || typeof payload.action !== "string") {
      return NextResponse.json({ error: "Action is required" }, { status: 400 });
    }

    if (payload.action === "item.markRead") {
      const itemId = payload.itemId;

      if (typeof itemId !== "string" || !itemId.trim()) {
        return NextResponse.json({ error: "Item ID is required" }, { status: 400 });
      }

      const result = await markFeedItemReadForUser(appUser.id, itemId);

      if (result.status === "not_found") {
        return NextResponse.json({ error: "Article not found" }, { status: 404 });
      }

      if (result.status === "already_read") {
        return NextResponse.json({
          itemId: result.itemId,
          readAt: result.readAt,
          alreadyRead: true,
        });
      }

      return NextResponse.json({ itemId: result.itemId, readAt: result.readAt });
    }

    if (payload.action === "account.delete") {
      const confirmed = payload.confirm === true;
      if (!confirmed) {
        return NextResponse.json(
          { error: "Account deletion must be explicitly confirmed." },
          { status: 400 }
        );
      }

      try {
        await deleteAuthUser(appUser.clerkId);
      } catch {
        return NextResponse.json(
          { error: "Could not delete authentication account." },
          { status: 500 }
        );
      }

      await db.delete(users).where(eq(users.id, appUser.id));

      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "Unsupported action" }, { status: 400 });
  } catch (error) {
    return handleApiRouteError(error, "api.feeds.patch");
  }
}
