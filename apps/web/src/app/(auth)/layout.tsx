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
import { AuthNavigation } from "@/components/auth-navigation";
import styles from "./layout.module.css";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className={styles.shell}>
      <header className={styles.header}>
        <AuthNavigation />
        <div className={styles.userMenu}>
          <UserMenu />
        </div>
      </header>

      <main className={styles.main}>{children}</main>
    </div>
  );
}
