/**
 * Module Boundary: Authentication
 *
 * This file is the ONLY place in the codebase that imports from @clerk/nextjs.
 * All authentication logic goes through this file. If we ever switch from
 * Clerk to another auth provider, only this file needs to change. (Principle 4)
 *
 * Current implementation: Clerk (@clerk/nextjs)
 *
 * What this file provides:
 *   - AuthProvider: React context provider for auth (wraps ClerkProvider)
 *   - SignInForm, SignUpForm, UserMenu: Pre-built auth UI components
 *   - getCurrentUser(): Get the authenticated user's Clerk ID and email
 *   - requireAuth(): Same as getCurrentUser but throws if not authenticated
 *   - verifyClerkWebhook(): Verify Clerk webhook signatures (via svix)
 *
 * Exception: middleware.ts also imports from @clerk/nextjs/server directly,
 * because Next.js middleware runs in a special edge context and needs
 * the clerkMiddleware wrapper. This is architectural boilerplate that would
 * be replaced by equivalent boilerplate from any new auth provider.
 */

import { auth, currentUser } from "@clerk/nextjs/server";
import { Webhook } from "svix";

/**
 * Re-export Clerk UI components through this module boundary.
 * Pages and layouts import these from "@/lib/auth" — never from "@clerk/nextjs" directly.
 * If we switch auth providers, we replace these exports with equivalents.
 */
export { ClerkProvider as AuthProvider } from "@clerk/nextjs";
export { SignIn as SignInForm } from "@clerk/nextjs";
export { SignUp as SignUpForm } from "@clerk/nextjs";
export { UserButton as UserMenu } from "@clerk/nextjs";

/**
 * Get the current authenticated user's info from Clerk.
 * Returns null if the user is not signed in.
 *
 * Use this in server components and API routes where you want to
 * check if a user is authenticated without forcing a redirect.
 */
export async function getCurrentUser() {
  const user = await currentUser();

  if (!user) {
    return null;
  }

  return {
    clerkId: user.id,
    email: user.emailAddresses[0]?.emailAddress ?? "",
  };
}

/**
 * Require authentication — throws a redirect to sign-in if not authenticated.
 * Use this in pages/routes that should never be accessible without auth.
 *
 * Returns the authenticated user's Clerk ID.
 */
export async function requireAuth() {
  const { userId } = await auth();

  if (!userId) {
    throw new Error("Unauthorized: user is not signed in");
  }

  return { clerkId: userId };
}

/**
 * Verify a Clerk webhook signature.
 *
 * Clerk uses Svix to sign webhooks. This function verifies that the request
 * actually came from Clerk and hasn't been tampered with. Without this,
 * anyone who knows the webhook URL could spoof user events.
 * (Principle 11: Security by Delegation)
 *
 * @param body - The raw request body as a string
 * @param headers - Object with svix-id, svix-timestamp, and svix-signature headers
 * @returns The verified webhook payload
 * @throws Error if the signature is invalid
 */
export function verifyClerkWebhook(
  body: string,
  headers: {
    "svix-id": string;
    "svix-timestamp": string;
    "svix-signature": string;
  }
) {
  const wh = new Webhook(process.env.CLERK_WEBHOOK_SECRET!);
  return wh.verify(body, headers) as {
    type: string;
    data: Record<string, unknown>;
  };
}
