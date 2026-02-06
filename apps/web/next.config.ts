/**
 * Next.js Configuration
 *
 * This config is wrapped with Sentry's withSentryConfig to enable
 * automatic error tracking and performance monitoring.
 *
 * Learn more: https://docs.sentry.io/platforms/javascript/guides/nextjs/
 */

import { withSentryConfig } from "@sentry/nextjs";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /**
   * Packages that should NOT be bundled by webpack.
   * Instead, they're loaded at runtime from node_modules.
   *
   * Why: During the build, Next.js evaluates route modules to collect page data.
   * This causes neon() to be called before DATABASE_URL is available (it's a
   * runtime env var, not a build-time one). By keeping the neon driver external,
   * it's only loaded when an actual request triggers the route handler.
   */
  serverExternalPackages: ["@neondatabase/serverless"],
};

/**
 * Sentry webpack plugin configuration.
 * The SENTRY_AUTH_TOKEN env var is required for source map uploads.
 * In development, Sentry will work without it (just no source maps).
 */
export default withSentryConfig(nextConfig, {
  // Suppresses source map upload logs during build
  silent: true,

  // Upload a larger set of source maps for prettier stack traces (increases build time)
  widenClientFileUpload: true,

  // Automatically tree-shake Sentry logger statements to reduce bundle size
  disableLogger: true,
});
