/**
 * API Route: /api/feeds
 *
 * GET  -> list feeds
 * POST -> discover/create feed
 * PATCH -> mark article read / delete uncategorized feeds / delete account
 */

import { NextRequest } from "next/server";
import { getFeedsRoute } from "./route.get";
import { postFeedsRoute } from "./route.post";
import { patchFeedsRoute } from "./route.patch";

export async function GET() {
  return await getFeedsRoute();
}

export async function POST(request: NextRequest) {
  return await postFeedsRoute(request);
}

export async function PATCH(request: NextRequest) {
  return await patchFeedsRoute(request);
}
