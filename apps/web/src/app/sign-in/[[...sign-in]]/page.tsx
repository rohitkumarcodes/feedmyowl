/**
 * Sign In Page
 *
 * Renders Clerk's pre-built <SignIn /> component.
 * The [[...sign-in]] catch-all route handles all sign-in sub-routes
 * (e.g., /sign-in, /sign-in/factor-one, etc.) that Clerk needs.
 *
 * Docs: https://clerk.com/docs/components/authentication/sign-in
 */

import { redirect } from "next/navigation";
import { getAuthUserId, SignInForm } from "@/lib/server/auth";
import { authEntryAppearance } from "@/app/auth-entry-appearance";
import styles from "@/app/auth-page.module.css";

/**
 * This page reads auth state at request time — never statically prerender.
 */
export const dynamic = "force-dynamic";

export default async function SignInPage() {
  const userId = await getAuthUserId();
  if (userId) {
    redirect("/feeds");
  }

  return (
    <div className={styles.root}>
      <div className={styles.logoHeader}>
        <div className={styles.owlLogo}>{"{o,o}"}</div>
        <h1 className={styles.appName}>feed my owl</h1>
      </div>
      <div className={styles.frame}>
        <SignInForm appearance={authEntryAppearance} />
      </div>
    </div>
  );
}
