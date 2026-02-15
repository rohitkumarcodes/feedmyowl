import type { IsoDateString } from "./common";

export type ArticleScopeDto =
  | { type: "all" }
  | { type: "unread" }
  | { type: "uncategorized" }
  | { type: "folder"; id: string }
  | { type: "feed"; id: string };

export interface ArticlePageItemDto {
  id: string;
  feedId: string;
  title: string | null;
  link: string | null;
  content: string | null;
  author: string | null;
  publishedAt: IsoDateString | null;
  readAt: IsoDateString | null;
  createdAt: IsoDateString;
}

export interface ArticlePageResponseBody {
  items: ArticlePageItemDto[];
  nextCursor: string | null;
  hasMore: boolean;
  limit: number;
  scope: ArticleScopeDto;
}
