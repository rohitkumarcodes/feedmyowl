import { describe, expect, it } from "vitest";
import type { ArticleViewModel } from "./feeds-types";
import { buildArticleSearchResults } from "./article-search";

function article(overrides: Partial<ArticleViewModel> & Pick<ArticleViewModel, "id">): ArticleViewModel {
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

    expect(buildArticleSearchResults(allArticles, "typescrpt").results.map((r) => r.article.id))
      .toContain("title-hit");
    expect(buildArticleSearchResults(allArticles, "securty").results.map((r) => r.article.id))
      .toContain("feed-hit");
    expect(buildArticleSearchResults(allArticles, "martnez").results.map((r) => r.article.id))
      .toContain("author-hit");
    expect(buildArticleSearchResults(allArticles, "rendring").results.map((r) => r.article.id))
      .toContain("snippet-hit");
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
    expect(results.results.map((result) => result.article.id)).toEqual(["newer", "older"]);
  });

  it("caps rendered results and keeps total match count", () => {
    const allArticles = Array.from({ length: 80 }, (_, index) =>
      article({
        id: `article-${index}`,
        title: `Searchable article ${index}`,
        feedTitle: "Bulk Feed",
        snippet: "Searchable content body",
      })
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

    const feedResult = buildArticleSearchResults(allArticles, "security");
    expect(feedResult.results[0]?.highlights.feedTitle.length).toBeGreaterThan(0);
  });
});
