import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { db, eq, users } from "@/lib/database";
import { captureError } from "@/lib/error-tracking";
import { ensureUserRecord } from "@/lib/app-user";
import { createCheckoutSession, createStripeCustomer } from "@/lib/payments";

export async function POST() {
  try {
    const { clerkId } = await requireAuth();
    const priceId = process.env.STRIPE_PRICE_ID;

    if (!priceId) {
      return NextResponse.json(
        { error: "Billing is not fully configured" },
        { status: 500 }
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
        { status: 500 }
      );
    }

    return NextResponse.json({ url: checkoutUrl });
  } catch (error) {
    captureError(error, { route: "billing.checkout" });
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
