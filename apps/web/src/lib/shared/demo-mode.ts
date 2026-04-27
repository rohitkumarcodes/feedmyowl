/**
 * Shared gate for local demo mode used by smoke tests and agent UI checks.
 *
 * Demo mode intentionally stays opt-in through FEEDMYOWL_DEMO_MODE=1. It is
 * never enabled on Vercel production, even if the variable is set by mistake.
 */
export function isDemoModeEnabled(): boolean {
  return (
    (process.env.FEEDMYOWL_DEMO_MODE === "1" ||
      process.env.NEXT_PUBLIC_FEEDMYOWL_DEMO_MODE === "1") &&
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
    process.env.NEXT_PUBLIC_VERCEL_ENV !== "production"
  );
}
