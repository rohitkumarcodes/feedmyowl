import Fuse, { type FuseResultMatch, type IFuseOptions } from "fuse.js";
import type { ArticleViewModel } from "./feeds-types";

export interface MatchRange {
  start: number;
  end: number;
}

export type HiddenMatchSource = "snippet" | "author";
type SearchMatchKey = "title" | "feedTitle" | "snippet" | "author";

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
  key: SearchMatchKey
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

function rangeLength(range: MatchRange): number {
  return range.end - range.start + 1;
}

function requiredRangeLength(queryLength: number, key: SearchMatchKey): number {
  const baseRequired = Math.max(2, Math.floor(queryLength * 0.8));
  if (key === "title" || key === "feedTitle") {
    return baseRequired;
  }

  return Math.max(2, Math.min(4, baseRequired));
}

function collectSignificantRangesForKey(
  matches: ReadonlyArray<FuseResultMatch> | undefined,
  key: SearchMatchKey,
  queryLength: number
): MatchRange[] {
  const ranges = collectRangesForKey(matches, key);
  if (ranges.length === 0) {
    return [];
  }

  const minLength = requiredRangeLength(queryLength, key);
  return ranges.filter((range) => rangeLength(range) >= minLength);
}

function collectHiddenMatchSources(
  snippetRanges: MatchRange[],
  authorRanges: MatchRange[]
): HiddenMatchSource[] {
  const hiddenSources: HiddenMatchSource[] = [];
  if (snippetRanges.length > 0) {
    hiddenSources.push("snippet");
  }

  if (authorRanges.length > 0) {
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
  const queryLength = normalizedQuery.length;
  const matchedResults = fuse.search(normalizedQuery);
  const significantResults = matchedResults
    .map((result) => {
      const titleRanges = collectSignificantRangesForKey(
        result.matches,
        "title",
        queryLength
      );
      const feedTitleRanges = collectSignificantRangesForKey(
        result.matches,
        "feedTitle",
        queryLength
      );
      const snippetRanges = collectSignificantRangesForKey(
        result.matches,
        "snippet",
        queryLength
      );
      const authorRanges = collectSignificantRangesForKey(
        result.matches,
        "author",
        queryLength
      );

      const hasSignificantMatch =
        titleRanges.length > 0 ||
        feedTitleRanges.length > 0 ||
        snippetRanges.length > 0 ||
        authorRanges.length > 0;

      if (!hasSignificantMatch) {
        return null;
      }

      return {
        result,
        highlights: {
          title: titleRanges,
          feedTitle: feedTitleRanges,
          hiddenSources: collectHiddenMatchSources(snippetRanges, authorRanges),
        },
      };
    })
    .filter((candidate): candidate is NonNullable<typeof candidate> => candidate !== null);

  significantResults.sort((left, right) => {
    const scoreDiff = (left.result.score ?? 1) - (right.result.score ?? 1);
    if (Math.abs(scoreDiff) > 1e-6) {
      return scoreDiff;
    }

    const leftTime = toComparableTimestamp(left.result.item);
    const rightTime = toComparableTimestamp(right.result.item);
    return rightTime - leftTime;
  });

  const cappedResults = significantResults.slice(0, maxResults).map((candidate) => ({
    article: candidate.result.item,
    score: candidate.result.score ?? 1,
    highlights: candidate.highlights,
  }));

  return {
    query: normalizedQuery,
    isActive: true,
    totalMatchCount: significantResults.length,
    maxResults,
    isCapped: significantResults.length > maxResults,
    results: cappedResults,
  };
}
