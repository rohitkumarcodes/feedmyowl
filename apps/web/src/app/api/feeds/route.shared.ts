import type { NextRequest } from "next/server";
import type { ApiErrorBody } from "@/contracts/api/common";
import { ensureUserRecord } from "@/lib/server/app-user";
import { requireAuth } from "@/lib/server/auth";
import { parseRequestJson } from "@/lib/server/http/request-json";

export type ApiError = ApiErrorBody;

export async function getAppUser() {
  const { clerkId } = await requireAuth();
  return await ensureUserRecord(clerkId);
}

export async function parseRouteJson(
  request: NextRequest,
): Promise<Record<string, unknown> | null> {
  return await parseRequestJson(request);
}
