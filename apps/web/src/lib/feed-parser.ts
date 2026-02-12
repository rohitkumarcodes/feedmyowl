/**
 * Module Boundary: Feed Parser
 *
 * This file is the ONLY place in the codebase that imports from "rss-parser".
 * All RSS/Atom feed parsing goes through this file. If we ever switch to a
 * different feed parsing library, only this file needs to change. (Principle 4)
 *
 * Current implementation: rss-parser
 *
 * What this file provides:
 *   - parseFeed(): Fetch and parse an RSS/Atom feed URL into a normalized format
 *   - parseFeedXml(): Parse RSS/Atom feed XML text into the same normalized format
 *
 * rss-parser handles RSS 1.0, RSS 2.0, and Atom feeds, including many
 * common malformations found in real-world feeds.
 */

import Parser from "rss-parser";
import { fetchFeedXml, type FetchRemoteTextOptions } from "@/lib/feed-fetcher";

/**
 * rss-parser instance. We create one and reuse it for all parsing.
 * Custom fields can be added here if needed in the future.
 */
const parser = new Parser();

/**
 * The normalized shape of a parsed feed.
 * This is our own type — not tied to rss-parser's internal types.
 * If we swap libraries, we keep this interface the same.
 */
export interface ParsedFeed {
  title: string | undefined;
  description: string | undefined;
  items: ParsedFeedItem[];
}

/**
 * The normalized shape of a single feed item (article/entry).
 */
export interface ParsedFeedItem {
  guid: string | undefined;
  title: string | undefined;
  link: string | undefined;
  content: string | undefined;
  author: string | undefined;
  publishedAt: Date | undefined;
}

type RawParsedFeed = Awaited<ReturnType<typeof parser.parseURL>>;

function normalizeParsedFeed(feed: RawParsedFeed): ParsedFeed {
  return {
    title: feed.title,
    description: feed.description,
    items: feed.items.map((item) => ({
      guid: item.guid || item.id,
      title: item.title,
      link: item.link,
      content: item["content:encoded"] || item.content || item.summary,
      author: item.creator || item.author,
      publishedAt: item.pubDate ? new Date(item.pubDate) : undefined,
    })),
  };
}

/**
 * Fetch and parse an RSS/Atom feed from a URL.
 *
 * @param url - The feed URL to fetch and parse
 * @returns A normalized ParsedFeed object with feed metadata and items
 * @throws Error if the URL is unreachable or the response is not a valid feed
 */
export interface ParseFeedWithCacheResultOk {
  status: "ok";
  parsedFeed: ParsedFeed;
  etag: string | null;
  lastModified: string | null;
  resolvedUrl: string;
}

export interface ParseFeedWithCacheResultNotModified {
  status: "not_modified";
  etag: string | null;
  lastModified: string | null;
  resolvedUrl: string;
}

export type ParseFeedWithCacheResult =
  | ParseFeedWithCacheResultOk
  | ParseFeedWithCacheResultNotModified;

export async function parseFeedWithCache(
  url: string,
  options: Omit<FetchRemoteTextOptions, "accept"> = {}
): Promise<ParseFeedWithCacheResult> {
  const fetched = await fetchFeedXml(url, options);

  if (fetched.status === "not_modified") {
    return {
      status: "not_modified",
      etag: fetched.etag,
      lastModified: fetched.lastModified,
      resolvedUrl: fetched.finalUrl,
    };
  }

  const parsedFeed = await parseFeedXml(fetched.text ?? "");

  return {
    status: "ok",
    parsedFeed,
    etag: fetched.etag,
    lastModified: fetched.lastModified,
    resolvedUrl: fetched.finalUrl,
  };
}

export async function parseFeedWithMetadata(
  url: string,
  options: Omit<FetchRemoteTextOptions, "accept"> = {}
): Promise<{
  parsedFeed: ParsedFeed;
  etag: string | null;
  lastModified: string | null;
  resolvedUrl: string;
}> {
  const result = await parseFeedWithCache(url, options);

  if (result.status === "not_modified") {
    throw new Error("Unexpected 304 response while fetching feed without validators");
  }

  return {
    parsedFeed: result.parsedFeed,
    etag: result.etag,
    lastModified: result.lastModified,
    resolvedUrl: result.resolvedUrl,
  };
}

export async function parseFeed(url: string): Promise<ParsedFeed> {
  const result = await parseFeedWithMetadata(url);
  return result.parsedFeed;
}

/**
 * Parse RSS/Atom XML content directly.
 *
 * @param xml - Raw XML content from a candidate feed endpoint
 * @returns A normalized ParsedFeed object with feed metadata and items
 * @throws Error if XML content is not a valid RSS/Atom feed
 */
export async function parseFeedXml(xml: string): Promise<ParsedFeed> {
  const feed = await parser.parseString(xml);
  return normalizeParsedFeed(feed);
}
