import type {
  ArticleViewModel,
  FeedViewModel,
  FolderViewModel,
} from "@/features/feeds/types/view-models";
import type { SidebarScope } from "@/features/feeds/types/scopes";
import { getFeedLabel } from "./feeds-workspace.selectors";

export type NavigationStep = 1 | -1;
type FeedScope = Extract<SidebarScope, { type: "feed" }>;

export interface ResolveVimArticleNavigationOptions {
  step: NavigationStep;
  selectedScope: SidebarScope;
  searchIsActive: boolean;
  feeds: FeedViewModel[];
  folders: FolderViewModel[];
  allArticles: ArticleViewModel[];
  visibleArticles: ArticleViewModel[];
  selectedArticleId: string | null;
  openArticleId: string | null;
}

export interface VimArticleNavigationResult {
  didMove: boolean;
  targetArticleId: string | null;
  targetScope?: FeedScope;
}

function buildSidebarFeedScopeOrder(
  feeds: FeedViewModel[],
  folders: FolderViewModel[],
  allArticles: ArticleViewModel[],
): string[] {
  const feedIdsWithArticles = new Set(allArticles.map((article) => article.feedId));

  const sortedFeeds = [...feeds].sort((left, right) =>
    getFeedLabel(left).localeCompare(getFeedLabel(right)),
  );
  const sortedFolders = [...folders].sort((left, right) =>
    left.name.localeCompare(right.name),
  );

  const orderedFeedIds: string[] = [];

  for (const feed of sortedFeeds) {
    if (feed.folderIds.length === 0) {
      orderedFeedIds.push(feed.id);
    }
  }

  for (const folder of sortedFolders) {
    for (const feed of sortedFeeds) {
      if (feed.folderIds.includes(folder.id)) {
        orderedFeedIds.push(feed.id);
      }
    }
  }

  const seenFeedIds = new Set<string>();
  const dedupedFeedIds: string[] = [];

  for (const feedId of orderedFeedIds) {
    if (seenFeedIds.has(feedId)) {
      continue;
    }
    seenFeedIds.add(feedId);

    if (!feedIdsWithArticles.has(feedId)) {
      continue;
    }

    dedupedFeedIds.push(feedId);
  }

  return dedupedFeedIds;
}

function resolveCurrentArticleId(
  visibleArticles: ArticleViewModel[],
  openArticleId: string | null,
  selectedArticleId: string | null,
): string | null {
  const visibleIds = new Set(visibleArticles.map((article) => article.id));

  if (openArticleId && visibleIds.has(openArticleId)) {
    return openArticleId;
  }

  if (selectedArticleId && visibleIds.has(selectedArticleId)) {
    return selectedArticleId;
  }

  return openArticleId ?? selectedArticleId;
}

function noMovementResult(): VimArticleNavigationResult {
  return {
    didMove: false,
    targetArticleId: null,
  };
}

export function resolveVimArticleNavigation(
  options: ResolveVimArticleNavigationOptions,
): VimArticleNavigationResult {
  const {
    step,
    selectedScope,
    searchIsActive,
    feeds,
    folders,
    allArticles,
    visibleArticles,
    selectedArticleId,
    openArticleId,
  } = options;

  if (visibleArticles.length === 0) {
    return noMovementResult();
  }

  const currentArticleId = resolveCurrentArticleId(
    visibleArticles,
    openArticleId,
    selectedArticleId,
  );

  const currentIndex = visibleArticles.findIndex(
    (article) => article.id === currentArticleId,
  );

  if (currentIndex < 0) {
    const fallbackIndex = step === 1 ? 0 : visibleArticles.length - 1;
    return {
      didMove: true,
      targetArticleId: visibleArticles[fallbackIndex].id,
    };
  }

  const nextInListIndex = currentIndex + step;
  if (nextInListIndex >= 0 && nextInListIndex < visibleArticles.length) {
    return {
      didMove: true,
      targetArticleId: visibleArticles[nextInListIndex].id,
    };
  }

  if (searchIsActive || selectedScope.type !== "feed") {
    return noMovementResult();
  }

  const orderedFeedIds = buildSidebarFeedScopeOrder(feeds, folders, allArticles);
  if (orderedFeedIds.length <= 1) {
    return noMovementResult();
  }

  const currentFeedIndex = orderedFeedIds.indexOf(selectedScope.feedId);
  if (currentFeedIndex < 0) {
    return noMovementResult();
  }

  const nextFeedIndex =
    (currentFeedIndex + step + orderedFeedIds.length) % orderedFeedIds.length;
  if (nextFeedIndex === currentFeedIndex) {
    return noMovementResult();
  }

  const nextFeedId = orderedFeedIds[nextFeedIndex];
  const nextFeedArticles = allArticles.filter((article) => article.feedId === nextFeedId);
  if (nextFeedArticles.length === 0) {
    return noMovementResult();
  }

  const targetArticle =
    step === 1 ? nextFeedArticles[0] : nextFeedArticles[nextFeedArticles.length - 1];

  return {
    didMove: true,
    targetArticleId: targetArticle.id,
    targetScope: {
      type: "feed",
      feedId: nextFeedId,
    },
  };
}
