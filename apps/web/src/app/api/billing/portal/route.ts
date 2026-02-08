import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { handleApiRouteError } from "@/lib/api-errors";
import { ensureUserRecord } from "@/lib/app-user";
import { createPortalSession } from "@/lib/payments";

export async function POST() {
  try {
    const { clerkId } = await requireAuth();
    const user = await ensureUserRecord(clerkId);

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    if (!user.stripeCustomerId) {
      return NextResponse.json(
        { error: "No billing profile found for this account" },
        { status: 400 }
      );
    }

    const portalUrl = await createPortalSession(user.stripeCustomerId);
    if (!portalUrl) {
      return NextResponse.json(
        { error: "Unable to open billing portal" },
        { status: 500 }
      );
    }

    return NextResponse.json({ url: portalUrl });
  } catch (error) {
    return handleApiRouteError(error, "api.billing.portal.post");
  }
}
