import type { ApiErrorBody } from "@/contracts/api/common";
import type {
  SettingsReadingModePatchRequestBody,
  SettingsReadingModePatchResponseBody,
} from "@/contracts/api/settings";
import { callJson } from "@/lib/client/api-client";

const JSON_HEADERS = { "Content-Type": "application/json" } as const;

export async function saveReadingMode(body: SettingsReadingModePatchRequestBody) {
  return await callJson<SettingsReadingModePatchResponseBody & Partial<ApiErrorBody>>(
    "/api/settings/reading-mode",
    {
      method: "PATCH",
      headers: JSON_HEADERS,
      body: JSON.stringify(body),
    },
  );
}
