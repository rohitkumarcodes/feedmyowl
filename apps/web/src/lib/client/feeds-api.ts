import { parseResponseJson } from "@/lib/client/http";

interface ApiCallResult<T> {
  ok: boolean;
  status: number;
  body: T | null;
  networkError: boolean;
}

async function callJson<T>(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<ApiCallResult<T>> {
  try {
    const response = await fetch(input, init);
    const body = await parseResponseJson<T>(response);
    return {
      ok: response.ok,
      status: response.status,
      body,
      networkError: false,
    };
  } catch {
    return {
      ok: false,
      status: 0,
      body: null,
      networkError: true,
    };
  }
}

export async function markItemRead(itemId: string) {
  return await callJson<{ error?: string }>("/api/feeds", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "item.markRead", itemId }),
  });
}

export async function refreshFeeds() {
  return await callJson<{ error?: string; results?: Array<{ status: string; newItemCount: number }> }>(
    "/api/refresh",
    { method: "POST" }
  );
}

export async function createFolder(name: string) {
  return await callJson<{
    error?: string;
    folder?: { id: string; name: string; createdAt?: string; updatedAt?: string };
  }>("/api/folders", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name }),
  });
}

export async function discoverFeed(url: string) {
  return await callJson<{
    error?: string;
    code?: string;
    status?: "single" | "multiple" | "duplicate";
    normalizedInputUrl?: string;
    candidates?: Array<{
      url: string;
      title: string | null;
      method: "direct" | "html_alternate" | "heuristic_path";
      duplicate: boolean;
      existingFeedId: string | null;
    }>;
  }>("/api/feeds", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "feed.discover",
      url,
    }),
  });
}

export async function createFeed(url: string, folderIds: string[]) {
  return await callJson<{
    error?: string;
    code?: string;
    duplicate?: boolean;
    message?: string;
    feed?: {
      id: string;
      title?: string | null;
      customTitle?: string | null;
      description?: string | null;
      url: string;
      folderIds?: string[];
      lastFetchedAt?: string | null;
      lastFetchStatus?: string | null;
      lastFetchErrorCode?: string | null;
      lastFetchErrorMessage?: string | null;
      lastFetchErrorAt?: string | null;
      createdAt?: string;
    };
  }>("/api/feeds", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "feed.create",
      url,
      folderIds,
    }),
  });
}

export async function deleteFeed(feedId: string) {
  return await callJson<{ error?: string }>(`/api/feeds/${feedId}`, {
    method: "DELETE",
  });
}

export async function renameFeed(feedId: string, name: string) {
  return await callJson<{
    error?: string;
    feed?: {
      id: string;
      title?: string | null;
      customTitle?: string | null;
      url?: string;
      updatedAt?: string;
    };
  }>(`/api/feeds/${feedId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name }),
  });
}

export async function setFeedFolders(feedId: string, folderIds: string[]) {
  return await callJson<{
    error?: string;
    feed?: {
      id: string;
      folderIds?: string[];
    };
  }>(`/api/feeds/${feedId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "feed.setFolders",
      folderIds,
    }),
  });
}

export async function renameFolder(folderId: string, name: string) {
  return await callJson<{
    error?: string;
    folder?: {
      id: string;
      name: string;
      createdAt?: string;
      updatedAt?: string;
    };
  }>(`/api/folders/${folderId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name }),
  });
}

export async function deleteFolder(
  folderId: string,
  mode: "remove_only" | "remove_and_unsubscribe_exclusive"
) {
  return await callJson<{
    error?: string;
    success?: boolean;
    mode?: "remove_only" | "remove_and_unsubscribe_exclusive";
    totalFeeds?: number;
    exclusiveFeeds?: number;
    crossListedFeeds?: number;
    unsubscribedFeeds?: number;
  }>(`/api/folders/${folderId}?mode=${mode}`, {
    method: "DELETE",
  });
}
