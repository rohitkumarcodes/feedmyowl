/**
 * Module Boundary: Error Tracking
 *
 * This file is the ONLY place in the codebase that imports from "@sentry/nextjs".
 * All error tracking and reporting goes through this file. If we ever switch
 * from Sentry to another error tracking service, only this file needs to
 * change. (Principle 4)
 *
 * Current implementation: Sentry (@sentry/nextjs)
 *
 * What this file provides:
 *   - captureError(): Report an error to Sentry
 *   - captureMessage(): Report a message/event to Sentry
 *
 * Note: Sentry's Next.js integration also requires:
 *   - next.config.ts: Wrapped with withSentryConfig
 *   - instrumentation.ts: Sentry.init() for server/edge runtimes
 *   - global-error.tsx: Sentry error boundary for the client
 *
 * These are Sentry-specific boilerplate that would be replaced by
 * equivalent boilerplate from any new error tracking provider.
 */

import * as Sentry from "@sentry/nextjs";

/**
 * Report an error to the error tracking service.
 * Call this in catch blocks or error handlers throughout the app.
 *
 * @param error - The error object to report
 * @param context - Optional extra context to attach to the error report
 */
export function captureError(
  error: unknown,
  context?: Record<string, unknown>
) {
  if (context) {
    Sentry.setContext("additional", context);
  }
  Sentry.captureException(error);
}

/**
 * Report a message/event to the error tracking service.
 * Use this for non-error events you want to track (e.g., unusual conditions).
 *
 * @param message - The message to report
 * @param level - Severity level: "info", "warning", or "error"
 */
export function captureMessage(
  message: string,
  level: "info" | "warning" | "error" = "info"
) {
  Sentry.captureMessage(message, level);
}
