import { describe, expect, it } from "vitest";
import type {
  ArticleViewModel,
  FeedViewModel,
  FolderViewModel,
} from "@/features/feeds/types/view-models";
import { resolveVimArticleNavigation } from "./article-keyboard-navigation";

function feed(
  overrides: Partial<FeedViewModel> &
    Pick<FeedViewModel, "id" | "title" | "folderIds" | "url">,
): FeedViewModel {
  return {
    id: overrides.id,
    title: overrides.title,
    customTitle: overrides.customTitle ?? null,
    description: overrides.description ?? null,
    url: overrides.url,
    folderIds: overrides.folderIds,
    lastFetchedAt: overrides.lastFetchedAt ?? null,
    lastFetchStatus: overrides.lastFetchStatus ?? null,
    lastFetchErrorCode: overrides.lastFetchErrorCode ?? null,
    lastFetchErrorMessage: overrides.lastFetchErrorMessage ?? null,
    lastFetchErrorAt: overrides.lastFetchErrorAt ?? null,
    createdAt: overrides.createdAt ?? "2026-01-01T00:00:00.000Z",
    items: overrides.items ?? [],
  };
}

function article(
  overrides: Partial<ArticleViewModel> &
    Pick<ArticleViewModel, "id" | "feedId" | "title" | "feedTitle">,
): ArticleViewModel {
  return {
    id: overrides.id,
    title: overrides.title,
    link: overrides.link ?? null,
    content: overrides.content ?? null,
    author: overrides.author ?? null,
    publishedAt: overrides.publishedAt ?? null,
    createdAt: overrides.createdAt ?? "2026-01-01T00:00:00.000Z",
    readAt: overrides.readAt ?? null,
    savedAt: overrides.savedAt ?? null,
    feedId: overrides.feedId,
    feedTitle: overrides.feedTitle,
    feedFolderIds: overrides.feedFolderIds ?? [],
    snippet: overrides.snippet ?? "",
  };
}

const folders: FolderViewModel[] = [
  {
    id: "folder-a",
    name: "Alpha Folder",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  },
  {
    id: "folder-b",
    name: "Beta Folder",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  },
];

const feeds: FeedViewModel[] = [
  feed({
    id: "feed-alpha",
    title: "Alpha Feed",
    url: "https://alpha.example/feed.xml",
    folderIds: [],
  }),
  feed({
    id: "feed-empty",
    title: "Echo Feed",
    url: "https://echo.example/feed.xml",
    folderIds: [],
  }),
  feed({
    id: "feed-mike",
    title: "Mike Feed",
    url: "https://mike.example/feed.xml",
    folderIds: ["folder-a", "folder-b"],
  }),
  feed({
    id: "feed-zulu",
    title: "Zulu Feed",
    url: "https://zulu.example/feed.xml",
    folderIds: ["folder-b"],
  }),
];

const allArticles: ArticleViewModel[] = [
  article({
    id: "a-new",
    title: "Alpha New",
    feedId: "feed-alpha",
    feedTitle: "Alpha Feed",
    createdAt: "2026-01-05T00:00:00.000Z",
  }),
  article({
    id: "a-old",
    title: "Alpha Old",
    feedId: "feed-alpha",
    feedTitle: "Alpha Feed",
    createdAt: "2026-01-01T00:00:00.000Z",
  }),
  article({
    id: "m-only",
    title: "Mike Only",
    feedId: "feed-mike",
    feedTitle: "Mike Feed",
    createdAt: "2026-01-04T00:00:00.000Z",
  }),
  article({
    id: "z-new",
    title: "Zulu New",
    feedId: "feed-zulu",
    feedTitle: "Zulu Feed",
    createdAt: "2026-01-03T00:00:00.000Z",
  }),
  article({
    id: "z-old",
    title: "Zulu Old",
    feedId: "feed-zulu",
    feedTitle: "Zulu Feed",
    createdAt: "2026-01-02T00:00:00.000Z",
  }),
];

describe("article-keyboard-navigation", () => {
  it("moves within the current visible list when a next item exists", () => {
    const visibleArticles = allArticles.filter((item) => item.feedId === "feed-alpha");
    const result = resolveVimArticleNavigation({
      step: 1,
      selectedScope: { type: "feed", feedId: "feed-alpha" },
      searchIsActive: false,
      feeds,
      folders,
      allArticles,
      visibleArticles,
      selectedArticleId: "a-new",
      openArticleId: "a-new",
    });

    expect(result).toEqual({
      didMove: true,
      targetArticleId: "a-old",
    });
  });

  it("uses selected article when open article is unavailable", () => {
    const visibleArticles = allArticles.filter((item) => item.feedId === "feed-alpha");
    const result = resolveVimArticleNavigation({
      step: 1,
      selectedScope: { type: "feed", feedId: "feed-alpha" },
      searchIsActive: false,
      feeds,
      folders,
      allArticles,
      visibleArticles,
      selectedArticleId: "a-new",
      openArticleId: "missing-open-id",
    });

    expect(result.targetArticleId).toBe("a-old");
  });

  it("switches to the next feed scope at end-of-feed and opens first article", () => {
    const visibleArticles = allArticles.filter((item) => item.feedId === "feed-alpha");
    const result = resolveVimArticleNavigation({
      step: 1,
      selectedScope: { type: "feed", feedId: "feed-alpha" },
      searchIsActive: false,
      feeds,
      folders,
      allArticles,
      visibleArticles,
      selectedArticleId: "a-old",
      openArticleId: "a-old",
    });

    expect(result).toEqual({
      didMove: true,
      targetArticleId: "m-only",
      targetScope: { type: "feed", feedId: "feed-mike" },
    });
  });

  it("switches to the previous feed scope at start-of-feed and opens last article", () => {
    const visibleArticles = allArticles.filter((item) => item.feedId === "feed-mike");
    const result = resolveVimArticleNavigation({
      step: -1,
      selectedScope: { type: "feed", feedId: "feed-mike" },
      searchIsActive: false,
      feeds,
      folders,
      allArticles,
      visibleArticles,
      selectedArticleId: "m-only",
      openArticleId: "m-only",
    });

    expect(result).toEqual({
      didMove: true,
      targetArticleId: "a-old",
      targetScope: { type: "feed", feedId: "feed-alpha" },
    });
  });

  it("wraps across feed-scope boundaries", () => {
    const visibleArticles = allArticles.filter((item) => item.feedId === "feed-zulu");
    const result = resolveVimArticleNavigation({
      step: 1,
      selectedScope: { type: "feed", feedId: "feed-zulu" },
      searchIsActive: false,
      feeds,
      folders,
      allArticles,
      visibleArticles,
      selectedArticleId: "z-old",
      openArticleId: "z-old",
    });

    expect(result).toEqual({
      didMove: true,
      targetArticleId: "a-new",
      targetScope: { type: "feed", feedId: "feed-alpha" },
    });
  });

  it("dedupes cross-listed feeds and skips feeds with no loaded articles", () => {
    const visibleArticles = allArticles.filter((item) => item.feedId === "feed-mike");
    const result = resolveVimArticleNavigation({
      step: 1,
      selectedScope: { type: "feed", feedId: "feed-mike" },
      searchIsActive: false,
      feeds,
      folders,
      allArticles,
      visibleArticles,
      selectedArticleId: "m-only",
      openArticleId: "m-only",
    });

    expect(result).toEqual({
      didMove: true,
      targetArticleId: "z-new",
      targetScope: { type: "feed", feedId: "feed-zulu" },
    });
  });

  it("does not cross scopes at boundaries for non-feed scopes", () => {
    const visibleArticles = allArticles;
    const result = resolveVimArticleNavigation({
      step: 1,
      selectedScope: { type: "all" },
      searchIsActive: false,
      feeds,
      folders,
      allArticles,
      visibleArticles,
      selectedArticleId: "z-old",
      openArticleId: "z-old",
    });

    expect(result).toEqual({
      didMove: false,
      targetArticleId: null,
    });
  });

  it("keeps navigation within search results and does not switch scope", () => {
    const visibleArticles = [allArticles[1]];
    const result = resolveVimArticleNavigation({
      step: 1,
      selectedScope: { type: "feed", feedId: "feed-alpha" },
      searchIsActive: true,
      feeds,
      folders,
      allArticles,
      visibleArticles,
      selectedArticleId: "a-old",
      openArticleId: "a-old",
    });

    expect(result).toEqual({
      didMove: false,
      targetArticleId: null,
    });
  });
});
