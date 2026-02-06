/**
 * Root Layout
 *
 * This is the top-level layout that wraps every page in the app.
 * It provides:
 *   1. ClerkProvider — makes authentication available to all pages
 *   2. Global CSS — base styles for the entire app
 *   3. HTML metadata — page title, description, etc.
 *
 * Clerk's <ClerkProvider> must be at the root so that auth state
 * is available everywhere (server components, client components, middleware).
 *
 * Docs: https://clerk.com/docs/components/clerk-provider
 */

import { AuthProvider } from "@/lib/auth";
import type { Metadata } from "next";
import "@/styles/globals.css";

/** Page metadata — shown in browser tab and search results */
export const metadata: Metadata = {
  title: "FeedMyOwl — Calm RSS Reader",
  description:
    "A minimalist RSS/Atom feed reader that preserves your attention.",
};

/**
 * Root layout component. Every page in the app is rendered inside this.
 */
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthProvider>
      <html lang="en">
        <body>{children}</body>
      </html>
    </AuthProvider>
  );
}
