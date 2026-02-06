/**
 * Authenticated Layout
 *
 * This layout wraps all pages inside the (auth) route group.
 * The (auth) group is a Next.js route group — the parentheses mean
 * it doesn't affect the URL path, it's just for organizing routes
 * that share this layout.
 *
 * Pages inside (auth):
 *   - /feeds — Main reading page
 *   - /settings — Account settings
 *
 * Authentication is enforced by Clerk's middleware (middleware.ts),
 * so by the time a user reaches these pages, they are guaranteed
 * to be signed in. This layout provides the shared UI shell
 * (header, navigation) for authenticated pages.
 */

import { UserMenu } from "@/lib/auth";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div>
      {/* Header with navigation and user menu */}
      <header
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "1rem 2rem",
          borderBottom: "1px solid #eee",
        }}
      >
        <nav style={{ display: "flex", gap: "1.5rem", alignItems: "center" }}>
          <a href="/feeds" style={{ fontWeight: "bold", fontSize: "1.1rem" }}>
            FeedMyOwl
          </a>
          <a href="/feeds">Feeds</a>
          <a href="/settings">Settings</a>
        </nav>
        {/* Clerk's UserButton — shows avatar, lets user manage account / sign out */}
        <UserMenu />
      </header>

      {/* Page content */}
      <main style={{ padding: "2rem" }}>{children}</main>
    </div>
  );
}
