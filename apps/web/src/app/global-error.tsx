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
        <div style={{ padding: "2rem", textAlign: "center" }}>
          <h1>Something went wrong</h1>
          <p style={{ marginTop: "1rem", color: "#666" }}>
            We&apos;ve been notified and are looking into it.
          </p>
          <button
            onClick={() => reset()}
            style={{
              marginTop: "1.5rem",
              padding: "0.5rem 1rem",
              cursor: "pointer",
              border: "1px solid #ccc",
              borderRadius: "4px",
              backgroundColor: "#fff",
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
