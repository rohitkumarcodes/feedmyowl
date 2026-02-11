import { NextRequest, NextResponse } from "next/server";
import { captureMessage } from "@/lib/error-tracking";

function getTrustedOrigins(): string[] {
  const trusted = new Set<string>([
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "https://app.feedmyowl.com",
  ]);

  if (process.env.NEXT_PUBLIC_APP_URL) {
    try {
      trusted.add(new URL(process.env.NEXT_PUBLIC_APP_URL).origin);
    } catch {
      // Ignore invalid app URL values.
    }
  }

  if (process.env.VERCEL_URL) {
    trusted.add(`https://${process.env.VERCEL_URL}`);
  }

  return [...trusted];
}

function extractOriginFromReferer(referer: string): string | null {
  try {
    return new URL(referer).origin;
  } catch {
    return null;
  }
}

export function assertTrustedWriteOrigin(
  request: NextRequest,
  routeKey: string
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
      { status: 403 }
    );
  }

  if (!trustedOrigins.includes(requestOrigin)) {
    captureMessage(
      `csrf.rejected route=${routeKey} reason=untrusted_origin origin=${requestOrigin}`,
      "warning"
    );
    return NextResponse.json(
      {
        error: "Cross-site request rejected.",
        code: "csrf_validation_failed",
      },
      { status: 403 }
    );
  }

  return null;
}
