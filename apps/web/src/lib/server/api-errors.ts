import "server-only";

import { NextResponse } from "next/server";
import { isAuthRequiredError } from "@/lib/server/auth";
import { captureError } from "@/lib/server/error-tracking";

/**
 * Map route exceptions to stable API responses while preserving auth semantics.
 */
export function handleApiRouteError(error: unknown, route: string) {
  if (isAuthRequiredError(error)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  captureError(error, { route });
  return NextResponse.json({ error: "Internal server error" }, { status: 500 });
}
