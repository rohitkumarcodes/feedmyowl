import Fuse, { type FuseResultMatch, type IFuseOptions } from "fuse.js";
import type { ArticleViewModel } from "@/features/feeds/types/view-models";

export interface MatchRange {
  start: number;
  end: number;
}

export type HiddenMatchSource = "snippet" | "author";
type SearchMatchKey = "title" | "feedTitle" | "snippet" | "author";
type VisibleMatchKey = "title" | "feedTitle";

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

interface FieldToken {
  key: VisibleMatchKey;
  normalizedValue: string;
  range: MatchRange;
}

interface FallbackTokenMatch {
  key: VisibleMatchKey;
  range: MatchRange;
  distance: number;
}

interface FallbackCandidate {
  article: ArticleViewModel;
  score: number;
  tokenMatch: FallbackTokenMatch;
}

const DEFAULT_MIN_QUERY_LENGTH = 2;
const DEFAULT_MAX_RESULTS = 50;

const STRICT_FUSE_OPTIONS: IFuseOptions<ArticleViewModel> = {
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

const TYPO_FALLBACK_FUSE_OPTIONS: IFuseOptions<ArticleViewModel> = {
  includeMatches: true,
  includeScore: true,
  ignoreLocation: true,
  threshold: 0.35,
  minMatchCharLength: 2,
  keys: [
    { name: "title", weight: 0.65 },
    { name: "feedTitle", weight: 0.35 },
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
  key: SearchMatchKey,
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
  queryLength: number,
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
  authorRanges: MatchRange[],
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

function normalizeAlphanumeric(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function extractFieldTokens(value: string, key: VisibleMatchKey): FieldToken[] {
  const tokens: FieldToken[] = [];
  const pattern = /[a-z0-9]+/gi;

  for (const match of value.matchAll(pattern)) {
    const index = match.index;
    const token = match[0];
    if (index === undefined || !token) {
      continue;
    }

    const normalizedValue = normalizeAlphanumeric(token);
    if (!normalizedValue) {
      continue;
    }

    tokens.push({
      key,
      normalizedValue,
      range: {
        start: index,
        end: index + token.length - 1,
      },
    });
  }

  return tokens;
}

function damerauLevenshteinDistance(left: string, right: string): number {
  if (left === right) {
    return 0;
  }

  if (left.length === 0) {
    return right.length;
  }

  if (right.length === 0) {
    return left.length;
  }

  const matrix = Array.from({ length: left.length + 1 }, () =>
    Array<number>(right.length + 1).fill(0),
  );

  for (let i = 0; i <= left.length; i += 1) {
    matrix[i][0] = i;
  }

  for (let j = 0; j <= right.length; j += 1) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= left.length; i += 1) {
    for (let j = 1; j <= right.length; j += 1) {
      const substitutionCost = left[i - 1] === right[j - 1] ? 0 : 1;

      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + substitutionCost,
      );

      if (
        i > 1 &&
        j > 1 &&
        left[i - 1] === right[j - 2] &&
        left[i - 2] === right[j - 1]
      ) {
        matrix[i][j] = Math.min(matrix[i][j], matrix[i - 2][j - 2] + 1);
      }
    }
  }

  return matrix[left.length][right.length];
}

function findBestFallbackTokenMatch(
  article: ArticleViewModel,
  normalizedQuery: string,
): FallbackTokenMatch | null {
  const tokens = [
    ...extractFieldTokens(article.title, "title"),
    ...extractFieldTokens(article.feedTitle, "feedTitle"),
  ];

  let bestMatch: FallbackTokenMatch | null = null;

  for (const token of tokens) {
    if (Math.abs(token.normalizedValue.length - normalizedQuery.length) > 1) {
      continue;
    }

    const distance = damerauLevenshteinDistance(normalizedQuery, token.normalizedValue);
    if (distance > 1) {
      continue;
    }

    if (
      !bestMatch ||
      distance < bestMatch.distance ||
      (distance === bestMatch.distance &&
        token.key === "title" &&
        bestMatch.key === "feedTitle")
    ) {
      bestMatch = {
        key: token.key,
        range: token.range,
        distance,
      };
    }

    // Best possible distance; no need to evaluate remaining tokens.
    if (bestMatch?.distance === 0) {
      break;
    }
  }

  return bestMatch;
}

function runStrictSearch(
  allArticles: ArticleViewModel[],
  normalizedQuery: string,
  maxResults: number,
): ArticleSearchResults {
  const fuse = new Fuse(allArticles, STRICT_FUSE_OPTIONS);
  const queryLength = normalizedQuery.length;
  const matchedResults = fuse.search(normalizedQuery);
  const significantResults = matchedResults
    .map((result) => {
      const titleRanges = collectSignificantRangesForKey(
        result.matches,
        "title",
        queryLength,
      );
      const feedTitleRanges = collectSignificantRangesForKey(
        result.matches,
        "feedTitle",
        queryLength,
      );
      const snippetRanges = collectSignificantRangesForKey(
        result.matches,
        "snippet",
        queryLength,
      );
      const authorRanges = collectSignificantRangesForKey(
        result.matches,
        "author",
        queryLength,
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
    .filter(
      (candidate): candidate is NonNullable<typeof candidate> => candidate !== null,
    );

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

function runTypoFallbackSearch(
  allArticles: ArticleViewModel[],
  normalizedQuery: string,
  normalizedTypoQuery: string,
  maxResults: number,
): ArticleSearchResults {
  const fallbackFuse = new Fuse(allArticles, TYPO_FALLBACK_FUSE_OPTIONS);
  const candidateSearchWindow = Math.max(maxResults * 6, maxResults);
  const coarseResults = fallbackFuse
    .search(normalizedQuery)
    .slice(0, candidateSearchWindow);

  const fallbackCandidates = coarseResults
    .map((result): FallbackCandidate | null => {
      const tokenMatch = findBestFallbackTokenMatch(result.item, normalizedTypoQuery);
      if (!tokenMatch || tokenMatch.distance > 1) {
        return null;
      }

      return {
        article: result.item,
        score: result.score ?? 1,
        tokenMatch,
      };
    })
    .filter((candidate): candidate is FallbackCandidate => candidate !== null);

  fallbackCandidates.sort((left, right) => {
    const distanceDiff = left.tokenMatch.distance - right.tokenMatch.distance;
    if (distanceDiff !== 0) {
      return distanceDiff;
    }

    const scoreDiff = left.score - right.score;
    if (Math.abs(scoreDiff) > 1e-6) {
      return scoreDiff;
    }

    return toComparableTimestamp(right.article) - toComparableTimestamp(left.article);
  });

  const cappedResults = fallbackCandidates.slice(0, maxResults).map((candidate) => ({
    article: candidate.article,
    score: candidate.score,
    highlights: {
      title: candidate.tokenMatch.key === "title" ? [candidate.tokenMatch.range] : [],
      feedTitle:
        candidate.tokenMatch.key === "feedTitle" ? [candidate.tokenMatch.range] : [],
      hiddenSources: [],
    },
  }));

  return {
    query: normalizedQuery,
    isActive: true,
    totalMatchCount: fallbackCandidates.length,
    maxResults,
    isCapped: fallbackCandidates.length > maxResults,
    results: cappedResults,
  };
}

export function buildArticleSearchResults(
  allArticles: ArticleViewModel[],
  query: string,
  options: BuildArticleSearchResultsOptions = {},
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

  const strictResults = runStrictSearch(allArticles, normalizedQuery, maxResults);
  if (strictResults.totalMatchCount > 0) {
    return strictResults;
  }

  const normalizedTypoQuery = normalizeAlphanumeric(normalizedQuery);
  if (normalizedTypoQuery.length < 4) {
    return strictResults;
  }

  return runTypoFallbackSearch(
    allArticles,
    normalizedQuery,
    normalizedTypoQuery,
    maxResults,
  );
}
