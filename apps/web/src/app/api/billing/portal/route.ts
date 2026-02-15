import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/server/auth";
import { handleApiRouteError } from "@/lib/server/api-errors";
import { ensureUserRecord } from "@/lib/server/app-user";
import { assertTrustedWriteOrigin } from "@/lib/server/csrf";
import { createPortalSession } from "@/lib/server/payments";
import type { BillingPortalResponseBody } from "@/contracts/api/billing";

export async function POST(request: NextRequest) {
  try {
    const csrfFailure = assertTrustedWriteOrigin(request, "api.billing.portal.post");
    if (csrfFailure) {
      return csrfFailure;
    }

    const { clerkId } = await requireAuth();
    const user = await ensureUserRecord(clerkId);

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    if (!user.stripeCustomerId) {
      return NextResponse.json(
        { error: "No billing profile found for this account" },
        { status: 400 },
      );
    }

    const portalUrl = await createPortalSession(user.stripeCustomerId);
    if (!portalUrl) {
      return NextResponse.json(
        { error: "Unable to open billing portal" },
        { status: 500 },
      );
    }

    return NextResponse.json({ url: portalUrl } satisfies BillingPortalResponseBody);
  } catch (error) {
    return handleApiRouteError(error, "api.billing.portal.post");
  }
}
