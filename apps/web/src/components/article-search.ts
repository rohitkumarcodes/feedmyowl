import Fuse, { type FuseResultMatch, type IFuseOptions } from "fuse.js";
import type { ArticleViewModel } from "./feeds-types";

export interface MatchRange {
  start: number;
  end: number;
}

export type HiddenMatchSource = "snippet" | "author";

export interface ArticleSearchHighlights {
  title: MatchRange[];
  feedTitle: MatchRange[];
  hiddenSources: HiddenMatchSource[];
}

export interface ArticleSearchResult {
  article: ArticleViewModel;
  score: number;
  highlights: ArticleSearchHighlights;
}

export interface BuildArticleSearchResultsOptions {
  minQueryLength?: number;
  maxResults?: number;
}

export interface ArticleSearchResults {
  query: string;
  isActive: boolean;
  totalMatchCount: number;
  maxResults: number;
  isCapped: boolean;
  results: ArticleSearchResult[];
}

const DEFAULT_MIN_QUERY_LENGTH = 2;
const DEFAULT_MAX_RESULTS = 50;

const FUSE_OPTIONS: IFuseOptions<ArticleViewModel> = {
  includeMatches: true,
  includeScore: true,
  ignoreLocation: true,
  threshold: 0.18,
  minMatchCharLength: 2,
  keys: [
    { name: "title", weight: 0.45 },
    { name: "feedTitle", weight: 0.3 },
    { name: "snippet", weight: 0.2 },
    { name: "author", weight: 0.05 },
  ],
};

function toComparableTimestamp(article: ArticleViewModel): number {
  const published = article.publishedAt ? Date.parse(article.publishedAt) : 0;
  if (!Number.isNaN(published) && published > 0) {
    return published;
  }

  const created = Date.parse(article.createdAt);
  return Number.isNaN(created) ? 0 : created;
}

function normalizeRanges(ranges: ReadonlyArray<readonly [number, number]>): MatchRange[] {
  if (ranges.length === 0) {
    return [];
  }

  const sorted = ranges
    .map(([left, right]) => ({
      start: Math.max(0, Math.min(left, right)),
      end: Math.max(0, Math.max(left, right)),
    }))
    .sort((a, b) => a.start - b.start || a.end - b.end);

  const merged: MatchRange[] = [];
  for (const range of sorted) {
    const previous = merged[merged.length - 1];
    if (!previous || range.start > previous.end + 1) {
      merged.push({ start: range.start, end: range.end });
      continue;
    }

    previous.end = Math.max(previous.end, range.end);
  }

  return merged;
}

function collectRangesForKey(
  matches: ReadonlyArray<FuseResultMatch> | undefined,
  key: "title" | "feedTitle"
): MatchRange[] {
  if (!matches || matches.length === 0) {
    return [];
  }

  const ranges: Array<readonly [number, number]> = [];
  for (const match of matches) {
    if (match.key !== key) {
      continue;
    }

    ranges.push(...match.indices);
  }

  return normalizeRanges(ranges);
}

function collectHiddenMatchSources(
  matches: ReadonlyArray<FuseResultMatch> | undefined
): HiddenMatchSource[] {
  if (!matches || matches.length === 0) {
    return [];
  }

  let hasSnippetMatch = false;
  let hasAuthorMatch = false;

  for (const match of matches) {
    if (match.key === "snippet") {
      hasSnippetMatch = true;
      continue;
    }

    if (match.key === "author") {
      hasAuthorMatch = true;
    }
  }

  const hiddenSources: HiddenMatchSource[] = [];
  if (hasSnippetMatch) {
    hiddenSources.push("snippet");
  }

  if (hasAuthorMatch) {
    hiddenSources.push("author");
  }

  return hiddenSources;
}

export function buildArticleSearchResults(
  allArticles: ArticleViewModel[],
  query: string,
  options: BuildArticleSearchResultsOptions = {}
): ArticleSearchResults {
  const minQueryLength = options.minQueryLength ?? DEFAULT_MIN_QUERY_LENGTH;
  const maxResults = options.maxResults ?? DEFAULT_MAX_RESULTS;
  const normalizedQuery = query.trim();

  if (normalizedQuery.length < minQueryLength) {
    return {
      query: normalizedQuery,
      isActive: false,
      totalMatchCount: 0,
      maxResults,
      isCapped: false,
      results: [],
    };
  }

  const fuse = new Fuse(allArticles, FUSE_OPTIONS);
  const matchedResults = fuse.search(normalizedQuery);

  matchedResults.sort((left, right) => {
    const scoreDiff = (left.score ?? 1) - (right.score ?? 1);
    if (Math.abs(scoreDiff) > 1e-6) {
      return scoreDiff;
    }

    const leftTime = toComparableTimestamp(left.item);
    const rightTime = toComparableTimestamp(right.item);
    return rightTime - leftTime;
  });

  const cappedResults = matchedResults.slice(0, maxResults).map((result) => ({
    article: result.item,
    score: result.score ?? 1,
    highlights: {
      title: collectRangesForKey(result.matches, "title"),
      feedTitle: collectRangesForKey(result.matches, "feedTitle"),
      hiddenSources: collectHiddenMatchSources(result.matches),
    },
  }));

  return {
    query: normalizedQuery,
    isActive: true,
    totalMatchCount: matchedResults.length,
    maxResults,
    isCapped: matchedResults.length > maxResults,
    results: cappedResults,
  };
}
