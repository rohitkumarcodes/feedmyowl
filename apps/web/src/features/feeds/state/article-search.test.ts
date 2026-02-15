import { describe, expect, it } from "vitest";
import type { ArticleViewModel } from "@/features/feeds/types/view-models";
import { buildArticleSearchResults } from "./article-search";

function article(
  overrides: Partial<ArticleViewModel> & Pick<ArticleViewModel, "id">,
): ArticleViewModel {
  return {
    id: overrides.id,
    title: overrides.title ?? "Untitled article",
    link: overrides.link ?? null,
    content: overrides.content ?? null,
    author: overrides.author ?? null,
    publishedAt: overrides.publishedAt ?? null,
    createdAt: overrides.createdAt ?? "2026-01-01T00:00:00.000Z",
    readAt: overrides.readAt ?? null,
    feedId: overrides.feedId ?? "feed-default",
    feedTitle: overrides.feedTitle ?? "Default Feed",
    feedFolderIds: overrides.feedFolderIds ?? [],
    snippet: overrides.snippet ?? "",
  };
}

describe("article-search", () => {
  it("performs fuzzy matching across title, feed title, author, and snippet", () => {
    const allArticles: ArticleViewModel[] = [
      article({
        id: "title-hit",
        title: "TypeScript release notes",
        feedTitle: "Compiler Weekly",
        author: "Someone",
        snippet: "Details about the new compiler release.",
      }),
      article({
        id: "feed-hit",
        title: "Daily roundup",
        feedTitle: "Security Watch",
        author: "Someone Else",
        snippet: "Threat update.",
      }),
      article({
        id: "author-hit",
        title: "Performance journal",
        feedTitle: "Backend Digest",
        author: "Alex Martinez",
        snippet: "Profiling update.",
      }),
      article({
        id: "snippet-hit",
        title: "Product diary",
        feedTitle: "UI Notes",
        author: "Jordan",
        snippet: "Experimenting with progressive rendering today.",
      }),
    ];

    expect(
      buildArticleSearchResults(allArticles, "typescrpt").results.map(
        (r) => r.article.id,
      ),
    ).toContain("title-hit");
    expect(
      buildArticleSearchResults(allArticles, "securty").results.map((r) => r.article.id),
    ).toContain("feed-hit");
    expect(
      buildArticleSearchResults(allArticles, "martnez").results.map((r) => r.article.id),
    ).toContain("author-hit");
    expect(
      buildArticleSearchResults(allArticles, "rendring").results.map((r) => r.article.id),
    ).toContain("snippet-hit");

    const authorResult = buildArticleSearchResults(allArticles, "martnez").results.find(
      (result) => result.article.id === "author-hit",
    );
    expect(authorResult?.highlights.hiddenSources).toEqual(["author"]);

    const snippetResult = buildArticleSearchResults(allArticles, "rendring").results.find(
      (result) => result.article.id === "snippet-hit",
    );
    expect(snippetResult?.highlights.hiddenSources).toEqual(["snippet"]);

    const titleResult = buildArticleSearchResults(allArticles, "typescrpt").results.find(
      (result) => result.article.id === "title-hit",
    );
    expect(titleResult?.highlights.hiddenSources).toEqual([]);
  });

  it("sorts by relevance first, then recency for ties", () => {
    const allArticles: ArticleViewModel[] = [
      article({
        id: "newer",
        title: "Release notes",
        feedTitle: "Tech Daily",
        createdAt: "2026-01-03T00:00:00.000Z",
        publishedAt: "2026-01-03T00:00:00.000Z",
      }),
      article({
        id: "older",
        title: "Release notes",
        feedTitle: "Tech Daily",
        createdAt: "2026-01-01T00:00:00.000Z",
        publishedAt: "2026-01-01T00:00:00.000Z",
      }),
    ];

    const results = buildArticleSearchResults(allArticles, "release");
    expect(results.results.map((result) => result.article.id)).toEqual([
      "newer",
      "older",
    ]);
  });

  it("caps rendered results and keeps total match count", () => {
    const allArticles = Array.from({ length: 80 }, (_, index) =>
      article({
        id: `article-${index}`,
        title: `Searchable article ${index}`,
        feedTitle: "Bulk Feed",
        snippet: "Searchable content body",
      }),
    );

    const results = buildArticleSearchResults(allArticles, "searchable");
    expect(results.totalMatchCount).toBe(80);
    expect(results.results).toHaveLength(50);
    expect(results.maxResults).toBe(50);
    expect(results.isCapped).toBe(true);
  });

  it("activates only when query meets minimum length", () => {
    const allArticles: ArticleViewModel[] = [
      article({
        id: "alpha",
        title: "Alpha",
        feedTitle: "Main",
      }),
    ];

    const inactive = buildArticleSearchResults(allArticles, "a");
    expect(inactive.isActive).toBe(false);
    expect(inactive.totalMatchCount).toBe(0);
    expect(inactive.results).toHaveLength(0);

    const active = buildArticleSearchResults(allArticles, "al");
    expect(active.isActive).toBe(true);
  });

  it("filters weak letter-scramble matches for stricter relevance", () => {
    const allArticles: ArticleViewModel[] = [
      article({
        id: "earth-title",
        title: "Earth systems briefing",
        feedTitle: "Planet Desk",
        snippet: "Global climate notes.",
      }),
      article({
        id: "earth-snippet",
        title: "Climate notes",
        feedTitle: "Research Wire",
        snippet: "Earth observations from orbit.",
      }),
      article({
        id: "heart-noise",
        title: "Heart health weekly",
        feedTitle: "Cardio Beat",
        snippet: "Nutrition and movement.",
      }),
      article({
        id: "art-noise",
        title: "The art of reading",
        feedTitle: "Culture Monthly",
        snippet: "Reviewing theater scripts.",
      }),
    ];

    const resultIds = buildArticleSearchResults(allArticles, "earth").results.map(
      (result) => result.article.id,
    );

    expect(resultIds).toContain("earth-title");
    expect(resultIds).toContain("earth-snippet");
    expect(resultIds).not.toContain("heart-noise");
    expect(resultIds).not.toContain("art-noise");
  });

  it("excludes fragmented heart matches with no significant contiguous range", () => {
    const allArticles: ArticleViewModel[] = [
      article({
        id: "weak-fragment",
        title: "The Art of Animation",
        feedTitle: "Culture Monthly",
      }),
      article({
        id: "strong-heart",
        title: "Heart health weekly",
        feedTitle: "Cardio Beat",
      }),
    ];

    const resultIds = buildArticleSearchResults(allArticles, "heart").results.map(
      (result) => result.article.id,
    );

    expect(resultIds).toContain("strong-heart");
    expect(resultIds).not.toContain("weak-fragment");
  });

  it("highlights only significant heart ranges in titles", () => {
    const allArticles: ArticleViewModel[] = [
      article({
        id: "mixed-fragments",
        title: "The Art and Heart of Animation",
        feedTitle: "Cinema",
      }),
    ];

    const result = buildArticleSearchResults(allArticles, "heart").results[0];
    expect(result?.article.id).toBe("mixed-fragments");
    expect(result?.highlights.title).toEqual([{ start: 12, end: 16 }]);
  });

  it("falls back for one-edit title typos and highlights the full matched token", () => {
    const allArticles: ArticleViewModel[] = [
      article({
        id: "fallback-heart",
        title: "Heart health weekly",
        feedTitle: "Cardio Beat",
      }),
      article({
        id: "fallback-noise",
        title: "The Art of Animation",
        feedTitle: "Culture Monthly",
      }),
    ];

    const results = buildArticleSearchResults(allArticles, "heaet");
    const resultIds = results.results.map((result) => result.article.id);

    expect(resultIds).toContain("fallback-heart");
    expect(resultIds).not.toContain("fallback-noise");

    const typoResult = results.results.find(
      (result) => result.article.id === "fallback-heart",
    );
    expect(typoResult?.highlights.title).toEqual([{ start: 0, end: 4 }]);
    expect(typoResult?.highlights.feedTitle).toEqual([]);
    expect(typoResult?.highlights.hiddenSources).toEqual([]);
  });

  it("keeps strict exact matches without adding fallback-only typo candidates", () => {
    const allArticles: ArticleViewModel[] = [
      article({
        id: "strict-heart",
        title: "Heart health weekly",
        feedTitle: "Cardio Beat",
      }),
      article({
        id: "strict-typo-only",
        title: "Heaet health weekly",
        feedTitle: "Cardio Beat",
      }),
    ];

    const resultIds = buildArticleSearchResults(allArticles, "heart").results.map(
      (result) => result.article.id,
    );

    expect(resultIds).toContain("strict-heart");
    expect(resultIds).not.toContain("strict-typo-only");
  });

  it("records all hidden match sources when multiple hidden fields match", () => {
    const allArticles: ArticleViewModel[] = [
      article({
        id: "both-hidden",
        title: "Daily briefing",
        feedTitle: "World Desk",
        author: "Earth Reporter",
        snippet: "Earth satellites captured new imagery.",
      }),
    ];

    const result = buildArticleSearchResults(allArticles, "earth");
    expect(result.results[0]?.highlights.hiddenSources).toEqual(["snippet", "author"]);
  });

  it("returns highlight ranges for title and feed title matches", () => {
    const allArticles: ArticleViewModel[] = [
      article({
        id: "highlight",
        title: "TypeScript release notes",
        feedTitle: "Security Watch",
        snippet: "Something else",
      }),
    ];

    const titleResult = buildArticleSearchResults(allArticles, "typescript");
    expect(titleResult.results[0]?.highlights.title.length).toBeGreaterThan(0);
    expect(titleResult.results[0]?.highlights.hiddenSources).toEqual([]);

    const feedResult = buildArticleSearchResults(allArticles, "security");
    expect(feedResult.results[0]?.highlights.feedTitle.length).toBeGreaterThan(0);
    expect(feedResult.results[0]?.highlights.hiddenSources).toEqual([]);
  });
});
