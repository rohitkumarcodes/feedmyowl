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
 * Security: In production, verify the webhook signature using
 * STRIPE_WEBHOOK_SECRET to ensure requests are genuinely from Stripe.
 *
 * TODO: Add webhook signature verification
 *
 * Docs: https://stripe.com/docs/webhooks
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/database";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { captureError } from "@/lib/error-tracking";

export async function POST(request: NextRequest) {
  try {
    const payload = await request.json();
    const { type, data } = payload;

    switch (type) {
      case "checkout.session.completed": {
        // User completed Stripe Checkout → upgrade to paid tier
        const customerId = data.object.customer as string;
        const subscriptionId = data.object.subscription as string;

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
        const canceledSubscriptionId = data.object.id as string;

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
    return NextResponse.json(
      { error: "Webhook processing failed" },
      { status: 500 }
    );
  }
}
