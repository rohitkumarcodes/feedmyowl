import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/server/auth";
import { handleApiRouteError } from "@/lib/server/api-errors";
import { db, eq, users } from "@/lib/server/database";
import { ensureUserRecord } from "@/lib/server/app-user";
import { assertTrustedWriteOrigin } from "@/lib/server/csrf";
import { createCheckoutSession, createStripeCustomer } from "@/lib/server/payments";
import type { BillingCheckoutResponseBody } from "@/contracts/api/billing";

export async function POST(request: NextRequest) {
  try {
    const csrfFailure = assertTrustedWriteOrigin(request, "api.billing.checkout.post");
    if (csrfFailure) {
      return csrfFailure;
    }

    const { clerkId } = await requireAuth();
    const priceId = process.env.STRIPE_PRICE_ID;

    if (!priceId) {
      return NextResponse.json(
        { error: "Billing is not fully configured" },
        { status: 500 },
      );
    }

    const user = await ensureUserRecord(clerkId);
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    let customerId = user.stripeCustomerId;
    if (!customerId) {
      customerId = await createStripeCustomer(user.email, clerkId);

      await db
        .update(users)
        .set({
          stripeCustomerId: customerId,
          updatedAt: new Date(),
        })
        .where(eq(users.id, user.id));
    }

    const checkoutUrl = await createCheckoutSession(customerId, priceId);
    if (!checkoutUrl) {
      return NextResponse.json(
        { error: "Unable to create checkout session" },
        { status: 500 },
      );
    }

    return NextResponse.json({ url: checkoutUrl } satisfies BillingCheckoutResponseBody);
  } catch (error) {
    return handleApiRouteError(error, "api.billing.checkout.post");
  }
}
