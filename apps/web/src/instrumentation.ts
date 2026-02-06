/**
 * Sentry Instrumentation
 *
 * This file initializes Sentry for server-side and edge runtimes.
 * Next.js automatically loads this file via the instrumentation hook.
 *
 * Sentry initialization for the client side happens in global-error.tsx
 * (the error boundary) and through the @sentry/nextjs webpack plugin
 * configured in next.config.ts.
 *
 * Docs: https://docs.sentry.io/platforms/javascript/guides/nextjs/
 */

import * as Sentry from "@sentry/nextjs";

/**
 * Capture errors from nested React Server Components.
 * Required by Sentry's Next.js integration for full error coverage.
 * See: https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/#errors-from-nested-react-server-components
 */
export const onRequestError = Sentry.captureRequestError;

export function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    // Server-side Sentry initialization
    Sentry.init({
      dsn: process.env.SENTRY_DSN,

      // Set the sample rate for performance monitoring.
      // Adjust this in production based on traffic volume.
      tracesSampleRate: 1.0,

      // Set to false in production if you don't want debug output
      debug: false,
    });
  }

  if (process.env.NEXT_RUNTIME === "edge") {
    // Edge runtime Sentry initialization
    Sentry.init({
      dsn: process.env.SENTRY_DSN,
      tracesSampleRate: 1.0,
      debug: false,
    });
  }
}
