import "server-only";

import { fetchRemoteText } from "@/lib/server/feed-fetcher";
import {
  extractYouTubeChannelIdFromHtml,
  extractYouTubeChannelIdFromUrl,
} from "@/lib/shared/youtube";

const YOUTUBE_HOSTNAMES = new Set([
  "youtube.com",
  "www.youtube.com",
  "m.youtube.com",
  "music.youtube.com",
]);

const YOUTUBE_HTML_ACCEPT_HEADER =
  "text/html,application/xhtml+xml;q=0.9,text/plain;q=0.8,*/*;q=0.1";

const YOUTUBE_CHANNEL_PAGE_TIMEOUT_MS = 7_000;

function normalizeHostname(hostname: string): string {
  return hostname.toLowerCase().replace(/\.$/, "");
}

function isYouTubeHostname(hostname: string): boolean {
  const normalized = normalizeHostname(hostname);
  if (YOUTUBE_HOSTNAMES.has(normalized)) {
    return true;
  }

  return normalized === "youtube.com" || normalized.endsWith(".youtube.com");
}

function looksLikeChannelPagePath(pathname: string): boolean {
  return (
    pathname.startsWith("/@") ||
    pathname.startsWith("/channel/") ||
    pathname.startsWith("/c/") ||
    pathname.startsWith("/user/")
  );
}

function toUploadsFeedUrl(channelId: string): string {
  return `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`;
}

/**
 * Resolve a user-submitted YouTube channel URL into YouTube's uploads feed URL.
 *
 * Returns null when the URL is not a YouTube hostname or we cannot confidently
 * derive a channel id.
 */
export async function resolveYouTubeChannelFeedUrl(
  inputUrl: string,
): Promise<string | null> {
  let parsed: URL;
  try {
    parsed = new URL(inputUrl);
  } catch {
    return null;
  }

  if (!isYouTubeHostname(parsed.hostname)) {
    return null;
  }

  const channelIdFromUrl = extractYouTubeChannelIdFromUrl(inputUrl);
  if (channelIdFromUrl) {
    return toUploadsFeedUrl(channelIdFromUrl);
  }

  if (!looksLikeChannelPagePath(parsed.pathname)) {
    return null;
  }

  try {
    const response = await fetchRemoteText(inputUrl, {
      timeoutMs: YOUTUBE_CHANNEL_PAGE_TIMEOUT_MS,
      retries: 0,
      maxRedirects: 5,
      accept: YOUTUBE_HTML_ACCEPT_HEADER,
    });

    if (response.status !== "ok") {
      return null;
    }

    const channelId = extractYouTubeChannelIdFromHtml(response.text ?? "");
    return channelId ? toUploadsFeedUrl(channelId) : null;
  } catch {
    return null;
  }
}
