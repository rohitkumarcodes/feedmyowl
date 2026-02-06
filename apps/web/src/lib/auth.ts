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
 *   - getCurrentUser(): Get the authenticated user's Clerk ID and email
 *   - requireAuth(): Same as getCurrentUser but throws if not authenticated
 *
 * Note: ClerkProvider (in layout.tsx) and clerkMiddleware (in middleware.ts)
 * are also Clerk-specific, but they are boilerplate wrappers that would
 * be replaced by equivalent wrappers from any new auth provider.
 */

import { auth, currentUser } from "@clerk/nextjs/server";

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
