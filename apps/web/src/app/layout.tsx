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

import { AuthProvider } from "@/lib/server/auth";
import { buildOwlFaviconDataUri, DEFAULT_OWL_ASCII } from "@/lib/shared/owl-brand";
import type { Metadata } from "next";
import "@/styles/globals.css";

const clerkAppearance = {
  variables: {
    colorPrimary: "#000000",
    colorBackground: "#ffffff",
    colorForeground: "#111111",
    colorMutedForeground: "#444444",
    colorInput: "#ffffff",
    colorInputForeground: "#111111",
    colorBorder: "#9a9a9a",
    fontFamily: "sans-serif",
    fontSize: "1rem",
    borderRadius: "0",
  },
  layout: {
    animations: false,
  },
  captcha: {
    theme: "light" as const,
  },
};

/** Page metadata — shown in browser tab and search results */
export const metadata: Metadata = {
  title: "feed my owl",
  description: "A minimalist RSS/Atom feed reader that preserves your attention.",
  icons: {
    icon: buildOwlFaviconDataUri(DEFAULT_OWL_ASCII),
  },
};

/**
 * Root layout component. Every page in the app is rendered inside this.
 */
export default function RootLayout({ children }: { children: React.ReactNode }) {
  const signInUrl = process.env.NEXT_PUBLIC_CLERK_SIGN_IN_URL ?? "/sign-in";
  const signUpUrl = process.env.NEXT_PUBLIC_CLERK_SIGN_UP_URL ?? "/sign-up";

  const configuredSignInFallback =
    process.env.NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL ?? "/feeds";
  const configuredSignUpFallback =
    process.env.NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL ?? "/feeds";

  // Prevent redirect loops if env vars are accidentally set to auth entry routes.
  const signInFallbackRedirectUrl =
    configuredSignInFallback === signInUrl ? "/feeds" : configuredSignInFallback;
  const signUpFallbackRedirectUrl =
    configuredSignUpFallback === signUpUrl ? "/feeds" : configuredSignUpFallback;

  return (
    <html lang="en">
      <body>
        <AuthProvider
          signInUrl={signInUrl}
          signUpUrl={signUpUrl}
          signInFallbackRedirectUrl={signInFallbackRedirectUrl}
          signUpFallbackRedirectUrl={signUpFallbackRedirectUrl}
          appearance={clerkAppearance}
        >
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
