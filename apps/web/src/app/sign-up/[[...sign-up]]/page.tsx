/**
 * Sign Up Page
 *
 * Renders Clerk's pre-built <SignUp /> component.
 * The [[...sign-up]] catch-all route handles all sign-up sub-routes
 * that Clerk needs internally.
 *
 * Docs: https://clerk.com/docs/components/authentication/sign-up
 */

import { redirect } from "next/navigation";
import { getAuthUserId } from "@/lib/server/auth";
import { SignUpForm } from "@/components/sign-up-form";
import styles from "@/app/auth-page.module.css";

/**
 * This page reads auth state at request time — never statically prerender.
 */
export const dynamic = "force-dynamic";

export default async function SignUpPage() {
  const userId = await getAuthUserId();
  if (userId) {
    redirect("/feeds");
  }

  return (
    <div className={styles.root}>
      <div className={styles.frame}>
        <div className={styles.header}>
          <h1 className={styles.title}>Sign up</h1>
          <p className={styles.subtitle}>Create your account</p>
        </div>
        <SignUpForm />
      </div>
    </div>
  );
}
