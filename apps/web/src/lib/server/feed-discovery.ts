import "server-only";

import { normalizeFeedUrl } from "@/lib/shared/feed-url";
import { fetchRemoteText } from "@/lib/server/feed-fetcher";

export type FeedDiscoveryMethod = "html_alternate" | "heuristic_path";

export interface FeedDiscoveryResult {
  candidates: string[];
  methodHints: Record<string, FeedDiscoveryMethod>;
}

const DISCOVERY_TIMEOUT_MS = 7_000;
const MAX_DISCOVERY_CANDIDATES = 5;
const FEED_TYPE_PATTERN = /(application\/(rss|atom)\+xml|application\/xml|text\/xml)/i;
const FEED_HINT_PATTERN = /(rss|atom|feed|xml)/i;
const COMMENT_PATTERN = /(comment|comments|reply|replies)/i;

const HEURISTIC_PATHS = [
  "/feed",
  "/feed.xml",
  "/rss",
  "/rss.xml",
  "/atom.xml",
  "/?feed=rss2",
] as const;

function buildWwwVariantUrl(inputUrl: string): string | null {
  let parsedInput: URL;
  try {
    parsedInput = new URL(inputUrl);
  } catch {
    return null;
  }

  const hostname = parsedInput.hostname.toLowerCase();

  if (hostname.startsWith("www.")) {
    return null;
  }

  if (hostname === "localhost" || hostname.endsWith(".localhost")) {
    return null;
  }

  if (!hostname.includes(".")) {
    return null;
  }

  parsedInput.hostname = `www.${hostname}`;
  return parsedInput.toString();
}

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");
}

function parseAttributes(tag: string): Record<string, string> {
  const attributes: Record<string, string> = {};
  const attributePattern = /([^\s=/>]+)\s*=\s*("([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/g;

  for (const match of tag.matchAll(attributePattern)) {
    const rawName = match[1];
    const rawValue = match[3] ?? match[4] ?? match[5] ?? "";

    attributes[rawName.toLowerCase()] = decodeHtmlEntities(rawValue.trim());
  }

  return attributes;
}

function shouldUseAlternateLink(attributes: Record<string, string>): boolean {
  const rel = attributes.rel?.toLowerCase() ?? "";
  const relTokens = rel.split(/\s+/).filter(Boolean);

  if (!relTokens.includes("alternate")) {
    return false;
  }

  const type = attributes.type?.toLowerCase() ?? "";

  if (type) {
    return FEED_TYPE_PATTERN.test(type);
  }

  const href = attributes.href ?? "";
  const title = attributes.title ?? "";
  return FEED_HINT_PATTERN.test(href) || FEED_HINT_PATTERN.test(title);
}

function shouldSkipCandidate(candidateUrl: string, title?: string): boolean {
  return COMMENT_PATTERN.test(candidateUrl) || COMMENT_PATTERN.test(title ?? "");
}

function buildHeuristicCandidates(inputUrl: string): string[] {
  const parsedInput = new URL(inputUrl);

  return HEURISTIC_PATHS.map((path) => new URL(path, parsedInput.origin).toString());
}

function addCandidate(
  result: FeedDiscoveryResult,
  rawCandidate: string,
  method: FeedDiscoveryMethod,
  normalizedInputUrl: string,
): void {
  const normalizedCandidate = normalizeFeedUrl(rawCandidate);

  if (!normalizedCandidate) {
    return;
  }

  if (normalizedCandidate === normalizedInputUrl) {
    return;
  }

  if (shouldSkipCandidate(normalizedCandidate)) {
    return;
  }

  if (result.methodHints[normalizedCandidate]) {
    return;
  }

  if (result.candidates.length >= MAX_DISCOVERY_CANDIDATES) {
    return;
  }

  result.candidates.push(normalizedCandidate);
  result.methodHints[normalizedCandidate] = method;
}

async function fetchHtml(inputUrl: string): Promise<string | null> {
  try {
    const response = await fetchRemoteText(inputUrl, {
      timeoutMs: DISCOVERY_TIMEOUT_MS,
      retries: 0,
      maxRedirects: 5,
      accept: "text/html,application/xhtml+xml;q=0.9,text/plain;q=0.8,*/*;q=0.1",
    });

    if (response.status !== "ok") {
      return null;
    }

    return response.text ?? null;
  } catch {
    return null;
  }
}

function extractAlternateCandidates(
  html: string,
  inputUrl: string,
  result: FeedDiscoveryResult,
  normalizedInputUrl: string,
): void {
  const linkTagPattern = /<link\b[^>]*>/gi;

  for (const match of html.matchAll(linkTagPattern)) {
    const tag = match[0];
    const attributes = parseAttributes(tag);

    if (!shouldUseAlternateLink(attributes)) {
      continue;
    }

    const href = attributes.href?.trim();

    if (!href) {
      continue;
    }

    let resolvedCandidate: string;
    try {
      resolvedCandidate = new URL(href, inputUrl).toString();
    } catch {
      continue;
    }

    if (shouldSkipCandidate(resolvedCandidate, attributes.title)) {
      continue;
    }

    addCandidate(result, resolvedCandidate, "html_alternate", normalizedInputUrl);
  }
}

/**
 * Best-effort feed discovery for a user-submitted site URL.
 * This intentionally stays conservative: one HTML fetch, a small heuristic list,
 * and a strict max candidate count to keep add-feed fast and predictable.
 */
export async function discoverFeedCandidates(
  inputUrl: string,
): Promise<FeedDiscoveryResult> {
  const normalizedInputUrl = normalizeFeedUrl(inputUrl);

  if (!normalizedInputUrl) {
    return { candidates: [], methodHints: {} };
  }

  const result: FeedDiscoveryResult = { candidates: [], methodHints: {} };
  const html = await fetchHtml(normalizedInputUrl);

  if (html) {
    extractAlternateCandidates(html, normalizedInputUrl, result, normalizedInputUrl);
  }

  if (!html) {
    const wwwVariantUrl = buildWwwVariantUrl(normalizedInputUrl);

    if (wwwVariantUrl) {
      const wwwHtml = await fetchHtml(wwwVariantUrl);
      if (wwwHtml) {
        extractAlternateCandidates(wwwHtml, wwwVariantUrl, result, normalizedInputUrl);
      }

      for (const candidate of buildHeuristicCandidates(wwwVariantUrl)) {
        addCandidate(result, candidate, "heuristic_path", normalizedInputUrl);
      }
    }
  }

  for (const candidate of buildHeuristicCandidates(normalizedInputUrl)) {
    addCandidate(result, candidate, "heuristic_path", normalizedInputUrl);
  }

  return result;
}
