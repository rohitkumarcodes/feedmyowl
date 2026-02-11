import type { NextRequest } from "next/server";
import { ensureUserRecord } from "@/lib/app-user";
import { requireAuth } from "@/lib/auth";
import { parseRequestJson } from "@/lib/http/request-json";

export interface ApiError {
  error: string;
  code?: string;
}

export async function getAppUser() {
  const { clerkId } = await requireAuth();
  return await ensureUserRecord(clerkId);
}

export async function parseRouteJson(
  request: NextRequest
): Promise<Record<string, unknown> | null> {
  return await parseRequestJson(request);
}
