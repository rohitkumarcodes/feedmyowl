import type { ApiErrorBody } from "@/contracts/api/common";
import type {
  AccountDeleteResponseBody,
  FeedIdDeleteResponseBody,
  FeedIdPatchResponseBody,
  FeedsCreateResponseBody,
  FeedsDiscoverResponseBody,
  FeedsGetResponseBody,
  MarkAllReadResponseBody,
  MarkReadResponseBody,
  UncategorizedDeleteResponseBody,
  UncategorizedMoveResponseBody,
} from "@/contracts/api/feeds";
import type { RefreshResponseBody } from "@/contracts/api/refresh";
import { callJson } from "@/lib/client/api-client";
import type {
  FeedImportPreview,
  FeedImportRequest,
  FeedImportResponse,
} from "@/lib/shared/feed-import-types";

const JSON_HEADERS = { "Content-Type": "application/json" } as const;

export async function getFeeds() {
  return await callJson<FeedsGetResponseBody & Partial<ApiErrorBody>>("/api/feeds");
}

export async function discoverFeed(url: string) {
  return await callJson<
    (FeedsDiscoverResponseBody & Partial<ApiErrorBody>) | ApiErrorBody
  >("/api/feeds", {
    method: "POST",
    headers: JSON_HEADERS,
    body: JSON.stringify({ action: "feed.discover", url }),
  });
}

export async function createFeed(url: string, folderIds: string[]) {
  return await callJson<(FeedsCreateResponseBody & Partial<ApiErrorBody>) | ApiErrorBody>(
    "/api/feeds",
    {
      method: "POST",
      headers: JSON_HEADERS,
      body: JSON.stringify({ action: "feed.create", url, folderIds }),
    },
  );
}

export async function markItemRead(itemId: string) {
  return await callJson<(MarkReadResponseBody & Partial<ApiErrorBody>) | ApiErrorBody>(
    "/api/feeds",
    {
      method: "PATCH",
      headers: JSON_HEADERS,
      body: JSON.stringify({ action: "item.markRead", itemId }),
    },
  );
}

export async function markAllItemsRead(
  scopeType: string,
  scopeId?: string,
) {
  return await callJson<
    (MarkAllReadResponseBody & Partial<ApiErrorBody>) | ApiErrorBody
  >("/api/feeds", {
    method: "PATCH",
    headers: JSON_HEADERS,
    body: JSON.stringify({
      action: "items.markAllRead",
      scopeType,
      ...(scopeId ? { scopeId } : {}),
    }),
  });
}

export async function deleteUncategorizedFeeds(confirm: boolean) {
  return await callJson<
    (UncategorizedDeleteResponseBody & Partial<ApiErrorBody>) | ApiErrorBody
  >("/api/feeds", {
    method: "PATCH",
    headers: JSON_HEADERS,
    body: JSON.stringify({ action: "uncategorized.delete", confirm }),
  });
}

export async function moveUncategorizedFeedsToFolder(folderId: string) {
  return await callJson<
    (UncategorizedMoveResponseBody & Partial<ApiErrorBody>) | ApiErrorBody
  >("/api/feeds", {
    method: "PATCH",
    headers: JSON_HEADERS,
    body: JSON.stringify({
      action: "uncategorized.move_to_folder",
      folderId,
    }),
  });
}

export async function deleteAccount(confirm = true) {
  return await callJson<
    (AccountDeleteResponseBody & Partial<ApiErrorBody>) | ApiErrorBody
  >("/api/feeds", {
    method: "PATCH",
    headers: JSON_HEADERS,
    body: JSON.stringify({ action: "account.delete", confirm }),
  });
}

export async function refreshFeeds() {
  return await callJson<Partial<RefreshResponseBody> & Partial<ApiErrorBody>>(
    "/api/refresh",
    { method: "POST" },
  );
}

export async function previewFeedImport(fileName: string, fileContents: string) {
  return await callJson<(FeedImportPreview & Partial<ApiErrorBody>) | ApiErrorBody>(
    "/api/feeds/import-preview",
    {
      method: "POST",
      headers: JSON_HEADERS,
      body: JSON.stringify({
        file: {
          fileName,
          fileContents,
        },
      }),
    },
  );
}

export async function importFeedEntriesChunk(body: FeedImportRequest) {
  return await callJson<(FeedImportResponse & Partial<ApiErrorBody>) | ApiErrorBody>(
    "/api/feeds/import",
    {
      method: "POST",
      headers: JSON_HEADERS,
      body: JSON.stringify(body),
    },
  );
}

export async function deleteFeed(feedId: string) {
  return await callJson<FeedIdDeleteResponseBody & Partial<ApiErrorBody>>(
    `/api/feeds/${feedId}`,
    {
      method: "DELETE",
    },
  );
}

export async function renameFeed(feedId: string, name: string) {
  return await callJson<FeedIdPatchResponseBody & Partial<ApiErrorBody>>(
    `/api/feeds/${feedId}`,
    {
      method: "PATCH",
      headers: JSON_HEADERS,
      body: JSON.stringify({ name }),
    },
  );
}

export async function setFeedFolders(feedId: string, folderIds: string[]) {
  return await callJson<FeedIdPatchResponseBody & Partial<ApiErrorBody>>(
    `/api/feeds/${feedId}`,
    {
      method: "PATCH",
      headers: JSON_HEADERS,
      body: JSON.stringify({
        action: "feed.setFolders",
        folderIds,
      }),
    },
  );
}
