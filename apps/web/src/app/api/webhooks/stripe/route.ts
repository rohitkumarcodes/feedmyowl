/**
 * Webhook: Stripe
 *
 * POST /api/webhooks/stripe
 *
 * Stripe sends webhooks when payment events occur (subscription created,
 * updated, canceled, payment failed, etc.). This handler updates
 * our database to reflect the user's current subscription status.
 *
 * Events handled:
 *   - checkout.session.completed: User completed a checkout → mark as paid
 *   - customer.subscription.deleted: Subscription canceled → mark as free
 *
 * Security: Every request is verified using the Stripe webhook secret
 * via Stripe's built-in signature verification. Unverified requests are rejected.
 * (Principle 11: Security by Delegation)
 *
 * Docs: https://stripe.com/docs/webhooks
 */

import { NextRequest, NextResponse } from "next/server";
import { verifyStripeWebhook } from "@/lib/server/payments";
import { db, eq, users } from "@/lib/server/database";
import { captureError } from "@/lib/server/error-tracking";

export async function POST(request: NextRequest) {
  try {
    // --- Step 1: Verify the webhook signature ---
    // Read the raw body and Stripe-Signature header needed for verification.
    // If the signature is invalid, verifyStripeWebhook() will throw.
    const body = await request.text();
    const signature = request.headers.get("stripe-signature");

    if (!signature) {
      return NextResponse.json(
        { error: "Missing Stripe-Signature header" },
        { status: 400 },
      );
    }

    let event;
    try {
      event = verifyStripeWebhook(body, signature);
    } catch {
      return NextResponse.json({ error: "Invalid webhook signature" }, { status: 401 });
    }

    // --- Step 2: Handle the verified event ---
    switch (event.type) {
      case "checkout.session.completed": {
        // User completed Stripe Checkout → upgrade to paid tier
        const session = event.data.object;
        const customerId = session.customer as string;
        const subscriptionId = session.subscription as string;

        await db
          .update(users)
          .set({
            subscriptionTier: "paid",
            stripeSubscriptionId: subscriptionId,
            updatedAt: new Date(),
          })
          .where(eq(users.stripeCustomerId, customerId));
        break;
      }

      case "customer.subscription.deleted": {
        // Subscription was canceled → downgrade to free tier
        const subscription = event.data.object;
        const canceledSubscriptionId = subscription.id;

        await db
          .update(users)
          .set({
            subscriptionTier: "free",
            stripeSubscriptionId: null,
            updatedAt: new Date(),
          })
          .where(eq(users.stripeSubscriptionId, canceledSubscriptionId));
        break;
      }

      default:
        // Ignore other event types
        break;
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    captureError(error, { webhook: "stripe" });
    return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 });
  }
}
