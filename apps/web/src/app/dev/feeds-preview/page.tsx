/**
 * Local fixture preview for the authenticated feeds workspace.
 *
 * This route lets a developer or coding agent inspect the real protected
 * feeds UI in `next dev` without creating a Clerk session or reading user data.
 */
import { notFound } from "next/navigation";
import { FeedsWorkspace } from "@/features/feeds/components/FeedsWorkspace";
import { createInitialPaginationByScopeKey } from "@/features/feeds/state/article-pagination-state";
import { getDemoFeeds, getDemoFolders } from "@/lib/server/demo-data";
import { scopeToKey } from "@/lib/shared/article-pagination";
import { isLocalFixturePreviewEnabled } from "@/lib/shared/demo-mode";

/**
 * This page is intentionally evaluated per request so env guards are current.
 */
export const dynamic = "force-dynamic";

/**
 * Renders the real feeds workspace with fake local fixture data only.
 */
export default function DevFeedsPreviewPage() {
  if (!isLocalFixturePreviewEnabled()) {
    notFound();
  }

  return (
    <FeedsWorkspace
      initialFeeds={getDemoFeeds()}
      initialFolders={getDemoFolders()}
      initialPaginationByScopeKey={createInitialPaginationByScopeKey({
        scopeKey: scopeToKey({ type: "all" }),
        nextCursor: null,
        hasMore: false,
      })}
      initialReadingMode="checker"
    />
  );
}
