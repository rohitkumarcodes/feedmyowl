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
 *
 * rss-parser handles RSS 1.0, RSS 2.0, and Atom feeds, including many
 * common malformations found in real-world feeds.
 */

import Parser from "rss-parser";

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

/**
 * Fetch and parse an RSS/Atom feed from a URL.
 *
 * @param url - The feed URL to fetch and parse
 * @returns A normalized ParsedFeed object with feed metadata and items
 * @throws Error if the URL is unreachable or the response is not a valid feed
 */
export async function parseFeed(url: string): Promise<ParsedFeed> {
  const feed = await parser.parseURL(url);

  return {
    title: feed.title,
    description: feed.description,
    items: feed.items.map((item) => ({
      guid: item.guid || item.id || item.link,
      title: item.title,
      link: item.link,
      content: item["content:encoded"] || item.content || item.summary,
      author: item.creator || item.author,
      publishedAt: item.pubDate ? new Date(item.pubDate) : undefined,
    })),
  };
}
