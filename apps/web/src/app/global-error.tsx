"use client";

import { useEffect } from "react";
import styles from "./global-error.module.css";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Global error:", error);
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
            {error.digest ? (
              <p className={styles.supportHint}>
                Support code: <code className={styles.supportCode}>{error.digest}</code>
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
