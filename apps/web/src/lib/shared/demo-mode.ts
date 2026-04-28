/**
 * Shared gates for local fixture data used by smoke tests and agent UI checks.
 *
 * Demo mode intentionally stays opt-in through FEEDMYOWL_DEMO_MODE=1. It is a
 * local-only compatibility path for Playwright smoke checks and cannot run on
 * Vercel Preview or Production, even if the variable is set by mistake.
 */
export function isDemoModeEnabled(): boolean {
  return (
    (process.env.FEEDMYOWL_DEMO_MODE === "1" ||
      process.env.NEXT_PUBLIC_FEEDMYOWL_DEMO_MODE === "1") &&
    process.env.VERCEL !== "1" &&
    process.env.VERCEL_ENV !== "production"
  );
}

/**
 * Client-side version of the demo-mode gate.
 *
 * Browser code can only read NEXT_PUBLIC_* variables, so local smoke tests set
 * NEXT_PUBLIC_FEEDMYOWL_DEMO_MODE=1 to avoid loading real Clerk auth hooks.
 */
export function isClientDemoModeEnabled(): boolean {
  return (
    process.env.NEXT_PUBLIC_FEEDMYOWL_DEMO_MODE === "1" &&
    process.env.NEXT_PUBLIC_VERCEL !== "1" &&
    process.env.NEXT_PUBLIC_VERCEL_ENV !== "production"
  );
}

/**
 * Middleware-safe local gate for letting /dev preview routes reach their page.
 *
 * The page-level guard below still decides whether to render or 404. This
 * separate check avoids sending local preview requests into Clerk first.
 */
export function canReachLocalFixturePreviewRoutes(): boolean {
  return (
    process.env.FEEDMYOWL_DEV_PREVIEW === "1" &&
    process.env.VERCEL !== "1" &&
    process.env.VERCEL_ENV !== "production"
  );
}

/**
 * Local-only gate for founder/developer fixture preview routes under /dev.
 *
 * These pages are meant for `next dev` only. Vercel Preview should use the real
 * Clerk login flow with non-production services instead of fixture bypasses.
 */
export function isLocalFixturePreviewEnabled(): boolean {
  return (
    process.env.NODE_ENV === "development" &&
    canReachLocalFixturePreviewRoutes()
  );
}
