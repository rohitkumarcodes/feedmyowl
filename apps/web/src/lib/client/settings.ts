import type { ApiErrorBody } from "@/contracts/api/common";
import type {
  SettingsLogoPatchRequestBody,
  SettingsLogoPatchResponseBody,
  SettingsReadingModePatchRequestBody,
  SettingsReadingModePatchResponseBody,
  SettingsThemePatchRequestBody,
  SettingsThemePatchResponseBody,
} from "@/contracts/api/settings";
import { callJson } from "@/lib/client/api-client";

const JSON_HEADERS = { "Content-Type": "application/json" } as const;

export async function saveOwlAscii(body: SettingsLogoPatchRequestBody) {
  return await callJson<SettingsLogoPatchResponseBody & Partial<ApiErrorBody>>(
    "/api/settings/logo",
    {
      method: "PATCH",
      headers: JSON_HEADERS,
      body: JSON.stringify(body),
    },
  );
}

export async function saveThemeMode(body: SettingsThemePatchRequestBody) {
  return await callJson<SettingsThemePatchResponseBody & Partial<ApiErrorBody>>(
    "/api/settings/theme",
    {
      method: "PATCH",
      headers: JSON_HEADERS,
      body: JSON.stringify(body),
    },
  );
}

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
