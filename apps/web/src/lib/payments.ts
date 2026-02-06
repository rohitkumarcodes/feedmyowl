/**
 * Module Boundary: Payments
 *
 * This file is the ONLY place in the codebase that imports from "stripe".
 * All payment-related logic goes through this file. If we ever switch from
 * Stripe to another payment provider, only this file needs to change. (Principle 4)
 *
 * Current implementation: Stripe
 *
 * What this file provides:
 *   - stripe: The initialized Stripe SDK instance (server-side)
 *   - createCheckoutSession(): Create a Stripe Checkout session for upgrading to paid
 *   - createPortalSession(): Create a Stripe Billing Portal session for managing subscription
 *
 * Stripe webhook handling is in /api/webhooks/stripe/route.ts but uses
 * the stripe instance exported from this file.
 */

import Stripe from "stripe";

/**
 * Stripe SDK instance (server-side only).
 * Uses the secret key from environment variables.
 */
export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2025-02-24.acacia",
});

/**
 * Create a Stripe Checkout session for upgrading to the paid tier.
 *
 * @param customerId - The Stripe customer ID (created when user first interacts with Stripe)
 * @param priceId - The Stripe price ID for the paid subscription
 * @returns The Checkout session URL to redirect the user to
 */
export async function createCheckoutSession(
  customerId: string,
  priceId: string
): Promise<string | null> {
  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: "subscription",
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${process.env.NEXT_PUBLIC_APP_URL}/settings?success=true`,
    cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/settings?canceled=true`,
  });

  return session.url;
}

/**
 * Create a Stripe Billing Portal session for managing an existing subscription.
 * This lets users update payment methods, cancel, etc. — all handled by Stripe's UI.
 *
 * @param customerId - The Stripe customer ID
 * @returns The portal session URL to redirect the user to
 */
export async function createPortalSession(
  customerId: string
): Promise<string | null> {
  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: `${process.env.NEXT_PUBLIC_APP_URL}/settings`,
  });

  return session.url;
}
