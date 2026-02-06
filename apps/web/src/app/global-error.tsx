/**
 * Global Error Boundary
 *
 * This component catches unhandled errors in the app and:
 *   1. Reports them to Sentry for tracking
 *   2. Shows a user-friendly error message
 *
 * Next.js requires global-error.tsx to define its own <html> and <body>
 * tags because it replaces the root layout when an error occurs.
 *
 * Docs: https://nextjs.org/docs/app/building-your-application/routing/error-handling
 * Sentry: https://docs.sentry.io/platforms/javascript/guides/nextjs/
 */

"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Report the error to Sentry when this component mounts
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="en">
      <body>
        <div
          style={{
            padding: "24px",
            textAlign: "center",
            color: "var(--text-primary)",
            backgroundColor: "var(--bg-primary)",
          }}
        >
          <h1>Something went wrong</h1>
          <p style={{ marginTop: "8px", color: "var(--text-secondary)" }}>
            We&apos;ve been notified and are looking into it.
          </p>
          <button
            onClick={() => reset()}
            style={{
              marginTop: "12px",
              padding: "6px 10px",
              cursor: "pointer",
              border: "1px solid var(--border)",
              borderRadius: "2px",
              backgroundColor: "transparent",
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
