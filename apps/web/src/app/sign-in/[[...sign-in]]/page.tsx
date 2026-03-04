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
import { getAuthUserId } from "@/lib/server/auth";
import { SignInForm } from "@/components/sign-in-form";
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
      <div className={styles.frame}>
        <div className={styles.header}>
          <h1 className={styles.title}>Sign in</h1>
          <p className={styles.subtitle}>Continue to your feeds</p>
        </div>
        <SignInForm />
      </div>
    </div>
  );
}
