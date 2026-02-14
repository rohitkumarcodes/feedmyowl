import { describe, expect, it } from "vitest";
import type { FeedViewModel, FolderViewModel } from "./feeds-types";
import {
  doesArticleMatchSidebarScope,
  selectAllArticles,
  selectListStatusMessage,
  selectScopeLabel,
  selectVisibleArticles,
} from "./feeds-workspace.selectors";

const folders: FolderViewModel[] = [
  {
    id: "folder-tech",
    name: "Tech",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  },
  {
    id: "folder-news",
    name: "News",
    createdAt: "2026-01-02T00:00:00.000Z",
    updatedAt: "2026-01-02T00:00:00.000Z",
  },
];

const feeds: FeedViewModel[] = [
  {
    id: "feed-a",
    title: "Feed A",
    customTitle: null,
    description: null,
    url: "https://a.example/feed.xml",
    folderIds: ["folder-tech"],
    lastFetchedAt: null,
    lastFetchStatus: null,
    lastFetchErrorCode: null,
    lastFetchErrorMessage: null,
    lastFetchErrorAt: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    items: [
      {
        id: "item-a-1",
        title: "A1",
        link: null,
        content: "A1 content",
        author: null,
        publishedAt: "2026-01-03T00:00:00.000Z",
        readAt: null,
        createdAt: "2026-01-03T00:00:00.000Z",
      },
    ],
  },
  {
    id: "feed-b",
    title: "Feed B",
    customTitle: null,
    description: null,
    url: "https://b.example/feed.xml",
    folderIds: ["folder-tech", "folder-news"],
    lastFetchedAt: null,
    lastFetchStatus: "error",
    lastFetchErrorCode: "timeout",
    lastFetchErrorMessage: "Request timed out",
    lastFetchErrorAt: "2026-01-05T00:00:00.000Z",
    createdAt: "2026-01-02T00:00:00.000Z",
    items: [
      {
        id: "item-b-1",
        title: "B1",
        link: null,
        content: "B1 content",
        author: null,
        publishedAt: "2026-01-04T00:00:00.000Z",
        readAt: null,
        createdAt: "2026-01-04T00:00:00.000Z",
      },
    ],
  },
  {
    id: "feed-c",
    title: "Feed C",
    customTitle: null,
    description: null,
    url: "https://c.example/feed.xml",
    folderIds: [],
    lastFetchedAt: null,
    lastFetchStatus: null,
    lastFetchErrorCode: null,
    lastFetchErrorMessage: null,
    lastFetchErrorAt: null,
    createdAt: "2026-01-03T00:00:00.000Z",
    items: [
      {
        id: "item-c-1",
        title: "C1",
        link: null,
        content: "C1 content",
        author: null,
        publishedAt: "2026-01-01T00:00:00.000Z",
        readAt: null,
        createdAt: "2026-01-01T00:00:00.000Z",
      },
    ],
  },
];

describe("feeds-workspace selectors", () => {
  it("matches articles against sidebar scopes", () => {
    const allArticles = selectAllArticles(feeds);

    const articleFromA = allArticles.find((article) => article.feedId === "feed-a");
    const articleFromB = allArticles.find((article) => article.feedId === "feed-b");
    const articleFromC = allArticles.find((article) => article.feedId === "feed-c");

    expect(articleFromA).toBeTruthy();
    expect(articleFromB).toBeTruthy();
    expect(articleFromC).toBeTruthy();

    expect(doesArticleMatchSidebarScope(articleFromA!, { type: "none" })).toBe(false);

    expect(doesArticleMatchSidebarScope(articleFromA!, { type: "all" })).toBe(true);
    expect(doesArticleMatchSidebarScope(articleFromB!, { type: "all" })).toBe(true);
    expect(doesArticleMatchSidebarScope(articleFromC!, { type: "all" })).toBe(true);

    expect(
      doesArticleMatchSidebarScope(articleFromA!, { type: "feed", feedId: "feed-a" })
    ).toBe(true);
    expect(
      doesArticleMatchSidebarScope(articleFromB!, { type: "feed", feedId: "feed-a" })
    ).toBe(false);

    expect(
      doesArticleMatchSidebarScope(articleFromB!, {
        type: "folder",
        folderId: "folder-news",
      })
    ).toBe(true);
    expect(
      doesArticleMatchSidebarScope(articleFromA!, {
        type: "folder",
        folderId: "folder-news",
      })
    ).toBe(false);

    expect(doesArticleMatchSidebarScope(articleFromC!, { type: "uncategorized" })).toBe(
      true
    );
    expect(doesArticleMatchSidebarScope(articleFromA!, { type: "uncategorized" })).toBe(
      false
    );
  });

  it("filters visible articles by folder scope", () => {
    const allArticles = selectAllArticles(feeds);

    const visible = selectVisibleArticles(allArticles, {
      type: "folder",
      folderId: "folder-news",
    });

    expect(visible.map((article) => article.id)).toEqual(["item-b-1"]);
  });

  it("filters visible articles by uncategorized scope", () => {
    const allArticles = selectAllArticles(feeds);

    const visible = selectVisibleArticles(allArticles, {
      type: "uncategorized",
    });

    expect(visible.map((article) => article.id)).toEqual(["item-c-1"]);
  });

  it("returns folder and uncategorized scope labels", () => {
    expect(selectScopeLabel(feeds, folders, { type: "folder", folderId: "folder-tech" })).toBe(
      "Tech"
    );
    expect(selectScopeLabel(feeds, folders, { type: "uncategorized" })).toBe("Uncategorized");
  });

  it("returns folder-scoped status messages from errored feeds", () => {
    const status = selectListStatusMessage(feeds, {
      type: "folder",
      folderId: "folder-news",
    });

    expect(status).toBe("Request timed out");
  });
});
