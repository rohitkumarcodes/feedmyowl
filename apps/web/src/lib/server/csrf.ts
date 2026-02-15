import "server-only";

import { NextRequest, NextResponse } from "next/server";
import { captureMessage } from "@/lib/server/error-tracking";
import { getTrustedOrigins } from "@/lib/server/trusted-origins";

function extractOriginFromReferer(referer: string): string | null {
  try {
    return new URL(referer).origin;
  } catch {
    return null;
  }
}

export function assertTrustedWriteOrigin(
  request: NextRequest,
  routeKey: string,
): NextResponse | null {
  const trustedOrigins = getTrustedOrigins();
  const originHeader = request.headers.get("origin");
  const refererHeader = request.headers.get("referer");

  const requestOrigin =
    originHeader || (refererHeader ? extractOriginFromReferer(refererHeader) : null);

  if (!requestOrigin) {
    captureMessage(`csrf.rejected route=${routeKey} reason=missing_origin`, "warning");
    return NextResponse.json(
      {
        error: "Cross-site request rejected.",
        code: "csrf_validation_failed",
      },
      { status: 403 },
    );
  }

  if (!trustedOrigins.includes(requestOrigin)) {
    captureMessage(
      `csrf.rejected route=${routeKey} reason=untrusted_origin origin=${requestOrigin}`,
      "warning",
    );
    return NextResponse.json(
      {
        error: "Cross-site request rejected.",
        code: "csrf_validation_failed",
      },
      { status: 403 },
    );
  }

  return null;
}
