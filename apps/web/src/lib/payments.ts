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
 *   - verifyStripeWebhook(): Verify Stripe webhook signatures
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

/**
 * Verify a Stripe webhook signature.
 *
 * Stripe signs every webhook request. This function verifies the signature
 * to ensure the request actually came from Stripe and hasn't been tampered with.
 * Without this, anyone who knows the webhook URL could spoof payment events.
 * (Principle 11: Security by Delegation)
 *
 * @param body - The raw request body as a string (NOT parsed JSON)
 * @param signature - The Stripe-Signature header value
 * @returns The verified Stripe event object
 * @throws Error if the signature is invalid
 */
export function verifyStripeWebhook(
  body: string,
  signature: string
): Stripe.Event {
  return stripe.webhooks.constructEvent(
    body,
    signature,
    process.env.STRIPE_WEBHOOK_SECRET!
  );
}
