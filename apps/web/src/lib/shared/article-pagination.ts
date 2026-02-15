export const DEFAULT_ARTICLE_PAGE_LIMIT = 40;
export const MAX_ARTICLE_PAGE_LIMIT = 80;

export type ArticleScope =
  | { type: "all" }
  | { type: "unread" }
  | { type: "saved" }
  | { type: "uncategorized" }
  | { type: "folder"; id: string }
  | { type: "feed"; id: string };

export interface EncodedArticleCursor {
  v: 1;
  sortKeyIso: string;
  itemId: string;
}

export interface ArticlePageItem {
  id: string;
  feedId: string;
  title: string | null;
  link: string | null;
  content: string | null;
  author: string | null;
  publishedAt: string | null;
  readAt: string | null;
  savedAt: string | null;
  createdAt: string;
}

export interface ArticlePageResponseBody {
  items: ArticlePageItem[];
  nextCursor: string | null;
  hasMore: boolean;
  limit: number;
  scope:
    | { type: "all" }
    | { type: "unread" }
    | { type: "saved" }
    | { type: "uncategorized" }
    | { type: "folder"; id: string }
    | { type: "feed"; id: string };
}

interface OkResult<T> {
  ok: true;
  value: T;
}

interface ErrorResult {
  ok: false;
  error: string;
  code: string;
}

export type ParseResult<T> = OkResult<T> | ErrorResult;

function decodeBase64Url(value: string): string {
  try {
    return Buffer.from(value, "base64url").toString("utf8");
  } catch {
    throw new Error("Invalid cursor encoding.");
  }
}

function encodeBase64Url(value: string): string {
  return Buffer.from(value, "utf8").toString("base64url");
}

function isStrictIsoDate(value: string): boolean {
  const parsed = new Date(value);
  return !Number.isNaN(parsed.valueOf()) && parsed.toISOString() === value;
}

export function encodeArticleCursor(cursor: EncodedArticleCursor): string {
  return encodeBase64Url(JSON.stringify(cursor));
}

export function decodeArticleCursor(token: string): ParseResult<EncodedArticleCursor> {
  if (!token.trim()) {
    return {
      ok: false,
      error: "Cursor is invalid.",
      code: "invalid_cursor",
    };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(decodeBase64Url(token));
  } catch {
    return {
      ok: false,
      error: "Cursor is invalid.",
      code: "invalid_cursor",
    };
  }

  if (!parsed || typeof parsed !== "object") {
    return {
      ok: false,
      error: "Cursor is invalid.",
      code: "invalid_cursor",
    };
  }

  const candidate = parsed as Partial<EncodedArticleCursor>;
  if (candidate.v !== 1) {
    return {
      ok: false,
      error: "Cursor version is not supported.",
      code: "invalid_cursor",
    };
  }

  if (typeof candidate.itemId !== "string" || !candidate.itemId.trim()) {
    return {
      ok: false,
      error: "Cursor is invalid.",
      code: "invalid_cursor",
    };
  }

  if (
    typeof candidate.sortKeyIso !== "string" ||
    !isStrictIsoDate(candidate.sortKeyIso)
  ) {
    return {
      ok: false,
      error: "Cursor is invalid.",
      code: "invalid_cursor",
    };
  }

  return {
    ok: true,
    value: {
      v: 1,
      sortKeyIso: candidate.sortKeyIso,
      itemId: candidate.itemId.trim(),
    },
  };
}

export function scopeToKey(scope: ArticleScope): string {
  if (scope.type === "all") {
    return "all";
  }

  if (scope.type === "unread") {
    return "unread";
  }

  if (scope.type === "saved") {
    return "saved";
  }

  if (scope.type === "uncategorized") {
    return "uncategorized";
  }

  return `${scope.type}:${scope.id}`;
}

export function parseScopeFromSearchParams(
  searchParams: URLSearchParams,
): ParseResult<ArticleScope> {
  const scopeType = searchParams.get("scopeType");

  if (!scopeType) {
    return {
      ok: false,
      error: "scopeType is required.",
      code: "invalid_scope_type",
    };
  }

  if (scopeType === "all") {
    return { ok: true, value: { type: "all" } };
  }

  if (scopeType === "unread") {
    return { ok: true, value: { type: "unread" } };
  }

  if (scopeType === "saved") {
    return { ok: true, value: { type: "saved" } };
  }

  if (scopeType === "uncategorized") {
    return { ok: true, value: { type: "uncategorized" } };
  }

  if (scopeType !== "folder" && scopeType !== "feed") {
    return {
      ok: false,
      error: "scopeType must be one of: all, unread, saved, uncategorized, folder, feed.",
      code: "invalid_scope_type",
    };
  }

  const scopeId = searchParams.get("scopeId");
  if (!scopeId || !scopeId.trim()) {
    return {
      ok: false,
      error: "scopeId is required for folder and feed scopes.",
      code: "invalid_scope_id",
    };
  }

  return {
    ok: true,
    value: {
      type: scopeType,
      id: scopeId.trim(),
    },
  };
}

export function parseArticlePageLimit(rawLimit: string | null): ParseResult<number> {
  if (rawLimit === null) {
    return { ok: true, value: DEFAULT_ARTICLE_PAGE_LIMIT };
  }

  const parsed = Number(rawLimit);
  if (!Number.isFinite(parsed) || !Number.isInteger(parsed) || parsed < 1) {
    return {
      ok: false,
      error: "limit must be a positive integer.",
      code: "invalid_limit",
    };
  }

  return {
    ok: true,
    value: Math.min(parsed, MAX_ARTICLE_PAGE_LIMIT),
  };
}
