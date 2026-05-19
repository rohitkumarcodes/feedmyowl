import type { NextRequest } from "next/server";
import type { ApiErrorBody } from "@/contracts/api/common";
import { parseRequestJson } from "@/lib/server/http/request-json";

export type ApiError = ApiErrorBody;

export async function parseRouteJson(
  request: NextRequest,
): Promise<Record<string, unknown> | null> {
  return await parseRequestJson(request);
}
