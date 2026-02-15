import type { ApiErrorBody } from "@/contracts/api/common";
import type {
  FolderCreateResponseBody,
  FolderDeleteMode,
  FolderDeleteResponseBody,
  FolderRenameResponseBody,
} from "@/contracts/api/folders";
import { callJson } from "@/lib/client/api-client";

const JSON_HEADERS = { "Content-Type": "application/json" } as const;

export async function createFolder(name: string) {
  return await callJson<FolderCreateResponseBody & Partial<ApiErrorBody>>(
    "/api/folders",
    {
      method: "POST",
      headers: JSON_HEADERS,
      body: JSON.stringify({ name }),
    },
  );
}

export async function renameFolder(folderId: string, name: string) {
  return await callJson<FolderRenameResponseBody & Partial<ApiErrorBody>>(
    `/api/folders/${folderId}`,
    {
      method: "PATCH",
      headers: JSON_HEADERS,
      body: JSON.stringify({ name }),
    },
  );
}

export async function deleteFolder(folderId: string, mode: FolderDeleteMode) {
  return await callJson<FolderDeleteResponseBody & Partial<ApiErrorBody>>(
    `/api/folders/${folderId}?mode=${mode}`,
    {
      method: "DELETE",
    },
  );
}
