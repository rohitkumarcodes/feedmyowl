import { NextRequest, NextResponse } from "next/server";
import { handleApiRouteError } from "@/lib/server/api-errors";
import {
  decodeArticleCursor,
  parseArticlePageLimit,
  parseScopeFromSearchParams,
} from "@/lib/shared/article-pagination";
import type { ArticlePageResponseBody } from "@/contracts/api/articles";
import { listArticlePage } from "@/lib/server/article-service";

export async function GET(request: NextRequest) {
  try {
    const scopeResult = parseScopeFromSearchParams(request.nextUrl.searchParams);
    if (!scopeResult.ok) {
      return NextResponse.json(
        {
          error: scopeResult.error,
          code: scopeResult.code,
        },
        { status: 400 },
      );
    }

    const limitResult = parseArticlePageLimit(request.nextUrl.searchParams.get("limit"));
    if (!limitResult.ok) {
      return NextResponse.json(
        {
          error: limitResult.error,
          code: limitResult.code,
        },
        { status: 400 },
      );
    }

    const rawCursor = request.nextUrl.searchParams.get("cursor");
    const decodedCursor = rawCursor ? decodeArticleCursor(rawCursor) : null;
    if (decodedCursor && !decodedCursor.ok) {
      return NextResponse.json(
        {
          error: decodedCursor.error,
          code: decodedCursor.code,
        },
        { status: 400 },
      );
    }

    const page = await listArticlePage({
      scope: scopeResult.value,
      cursor: decodedCursor?.ok ? decodedCursor.value : null,
      limit: limitResult.value,
    });

    if (page.status === "scope_not_found") {
      const message =
        scopeResult.value.type === "folder"
          ? "Folder not found"
          : scopeResult.value.type === "feed"
            ? "Feed not found"
            : "Scope not found";

      return NextResponse.json({ error: message }, { status: 404 });
    }

    const responseBody: ArticlePageResponseBody = {
      items: page.items.map((item) => ({
        id: item.id,
        feedId: item.feedId,
        title: item.title,
        link: item.link,
        content: item.content,
        author: item.author,
        publishedAt: item.publishedAt?.toISOString() ?? null,
        readAt: item.readAt?.toISOString() ?? null,
        savedAt: item.savedAt?.toISOString() ?? null,
        createdAt: item.createdAt.toISOString(),
      })),
      nextCursor: page.nextCursor,
      hasMore: page.hasMore,
      limit: page.limit,
      scope:
        page.scope.type === "folder" || page.scope.type === "feed"
          ? { type: page.scope.type, id: page.scope.id }
          : { type: page.scope.type },
    };

    return NextResponse.json(responseBody);
  } catch (error) {
    return handleApiRouteError(error, "api.articles.get");
  }
}
