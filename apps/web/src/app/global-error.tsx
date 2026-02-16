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
import styles from "./global-error.module.css";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const correlationId = error.digest?.trim() ? error.digest.trim() : null;

  useEffect(() => {
    // Report the error to Sentry when this component mounts
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="en">
      <body>
        <div className={styles.root}>
          <div className={styles.panel}>
            <h1 className={styles.title}>Something went wrong</h1>
            <p className={styles.message}>
              Try again. If this keeps happening, refresh the page and try one more time.
            </p>
            {correlationId ? (
              <p className={styles.supportHint}>
                Support code: <code className={styles.supportCode}>{correlationId}</code>
              </p>
            ) : null}
            <button className={styles.button} onClick={() => reset()}>
              Try again
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
