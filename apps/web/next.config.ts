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
  /* Add Next.js config options here as needed */
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
