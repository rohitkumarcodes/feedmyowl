/**
 * YouTube helpers used by both server and client code.
 *
 * Important: This module must stay browser-safe (no Node imports).
 */

const YOUTUBE_HOST_PATTERN = /(^|\.)youtube\.com$/i;
const YOUTU_BE_HOST_PATTERN = /(^|\.)youtu\.be$/i;

const YOUTUBE_VIDEO_ID_PATTERN = /^[A-Za-z0-9_-]{11}$/;
const YOUTUBE_CHANNEL_ID_PATTERN = /^UC[0-9A-Za-z_-]{22}$/;

function isYouTubeHostname(hostname: string): boolean {
  return YOUTUBE_HOST_PATTERN.test(hostname);
}

function isYoutuBeHostname(hostname: string): boolean {
  return YOUTU_BE_HOST_PATTERN.test(hostname);
}

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");
}

function parseAttributes(tag: string): Record<string, string> {
  const attributes: Record<string, string> = {};
  const attributePattern =
    /([^\s=/>]+)\s*=\s*("([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/g;

  for (const match of tag.matchAll(attributePattern)) {
    const rawName = match[1];
    const rawValue = match[3] ?? match[4] ?? match[5] ?? "";
    attributes[rawName.toLowerCase()] = decodeHtmlEntities(rawValue.trim());
  }

  return attributes;
}

function normalizeHostname(hostname: string): string {
  return hostname.toLowerCase().replace(/\.$/, "");
}

/**
 * Extract a YouTube video id from common video URLs.
 */
export function extractYouTubeVideoId(url: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }

  const hostname = normalizeHostname(parsed.hostname);

  if (isYoutuBeHostname(hostname)) {
    const segment = parsed.pathname.split("/").filter(Boolean)[0] ?? "";
    return YOUTUBE_VIDEO_ID_PATTERN.test(segment) ? segment : null;
  }

  if (!isYouTubeHostname(hostname)) {
    return null;
  }

  if (parsed.pathname === "/watch") {
    const candidate = parsed.searchParams.get("v") ?? "";
    return YOUTUBE_VIDEO_ID_PATTERN.test(candidate) ? candidate : null;
  }

  const pathSegments = parsed.pathname.split("/").filter(Boolean);
  const route = pathSegments[0] ?? "";
  const candidate = pathSegments[1] ?? "";

  if ((route === "shorts" || route === "embed" || route === "live") && candidate) {
    return YOUTUBE_VIDEO_ID_PATTERN.test(candidate) ? candidate : null;
  }

  return null;
}

/**
 * Extract a YouTube channel id from a URL that includes /channel/UC...
 */
export function extractYouTubeChannelIdFromUrl(url: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }

  const hostname = normalizeHostname(parsed.hostname);
  if (!isYouTubeHostname(hostname)) {
    return null;
  }

  const match = parsed.pathname.match(/\/channel\/(UC[0-9A-Za-z_-]{22})(?:[/?#]|$)/);
  if (!match) {
    return null;
  }

  const candidate = match[1];
  return YOUTUBE_CHANNEL_ID_PATTERN.test(candidate) ? candidate : null;
}

/**
 * Extract a YouTube channel id from HTML fetched from a YouTube channel page.
 *
 * We intentionally avoid "first UC..." extraction without a key because it's
 * too risky to subscribe users to the wrong channel if YouTube's markup changes.
 */
export function extractYouTubeChannelIdFromHtml(html: string): string | null {
  if (!html) {
    return null;
  }

  // 1) <link rel="canonical" href=".../channel/UC...">
  const linkTagPattern = /<link\b[^>]*>/gi;
  for (const match of html.matchAll(linkTagPattern)) {
    const tag = match[0];
    const attributes = parseAttributes(tag);
    const rel = attributes.rel?.toLowerCase() ?? "";
    const relTokens = rel.split(/\s+/).filter(Boolean);
    if (!relTokens.includes("canonical")) {
      continue;
    }

    const href = attributes.href ?? "";
    const canonicalMatch = href.match(/\/channel\/(UC[0-9A-Za-z_-]{22})(?:[/?#]|$)/);
    if (!canonicalMatch) {
      continue;
    }

    const candidate = canonicalMatch[1];
    if (YOUTUBE_CHANNEL_ID_PATTERN.test(candidate)) {
      return candidate;
    }
  }

  // 2) channel_id=UC... occurrences (feed link hints).
  const channelIdParamMatch = html.match(/channel_id=(UC[0-9A-Za-z_-]{22})/);
  if (channelIdParamMatch && YOUTUBE_CHANNEL_ID_PATTERN.test(channelIdParamMatch[1])) {
    return channelIdParamMatch[1];
  }

  // 3) JSON keys in embedded data.
  const keys = ["externalId", "channelId", "browseId"] as const;
  for (const key of keys) {
    const unescaped = new RegExp(
      `"${key}"\\s*:\\s*"(UC[0-9A-Za-z_-]{22})"`
    );
    const escaped = new RegExp(
      `\\\\"${key}\\\\\"\\s*:\\s*\\\\\"(UC[0-9A-Za-z_-]{22})\\\\\"`
    );

    const match = html.match(unescaped) ?? html.match(escaped);
    const candidate = match?.[1];
    if (candidate && YOUTUBE_CHANNEL_ID_PATTERN.test(candidate)) {
      return candidate;
    }
  }

  return null;
}

