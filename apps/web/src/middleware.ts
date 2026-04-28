/**
 * Clerk Authentication Middleware
 *
 * This middleware runs on every request and handles authentication.
 * It uses Clerk's clerkMiddleware() which:
 *   - Attaches auth state to the request (available via auth() in server components)
 *   - Does NOT block unauthenticated users by default
 *
 * We use createRouteMatcher to define which routes require authentication.
 * Public routes (sign-in, sign-up, webhooks) are accessible without auth.
 * Everything else redirects to sign-in if the user is not authenticated.
 *
 * Docs: https://clerk.com/docs/references/nextjs/clerk-middleware
 */

import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse, type NextFetchEvent, type NextRequest } from "next/server";
import { isDemoModeEnabled } from "@/lib/shared/demo-mode";
import { getTrustedOrigins } from "@/lib/server/trusted-origins";

/**
 * Routes that do NOT require authentication.
 * The exact /dev preview routes are public at middleware level so their own
 * local-only page guards can return 404 outside next dev. All other routes
 * require the user to be signed in.
 */
const isPublicRoute = createRouteMatcher([
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/dev/feeds-preview",
  "/dev/settings-preview",
  "/api/webhooks(.*)",
]);

const clerkAuthMiddleware = clerkMiddleware(
  async (auth, request) => {
    // If the route is not public, require authentication.
    // Unauthenticated users will be redirected to the sign-in page.
    if (!isPublicRoute(request)) {
      await auth.protect();
    }
  },
  {
    authorizedParties: getTrustedOrigins(),
  },
);

export default function middleware(request: NextRequest, event: NextFetchEvent) {
  if (isDemoModeEnabled()) {
    return NextResponse.next();
  }

  return clerkAuthMiddleware(request, event);
}

/**
 * Next.js middleware matcher configuration.
 * This tells Next.js which routes should run through this middleware.
 * We exclude static files and Next.js internals.
 */
export const config = {
  matcher: [
    // Skip Next.js internals and all static files
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes
    "/(api|trpc)(.*)",
  ],
};
