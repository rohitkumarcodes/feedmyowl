/**
 * Sign In Page
 *
 * Renders Clerk's pre-built <SignIn /> component.
 * The [[...sign-in]] catch-all route handles all sign-in sub-routes
 * (e.g., /sign-in, /sign-in/factor-one, etc.) that Clerk needs.
 *
 * Docs: https://clerk.com/docs/components/authentication/sign-in
 */

import { SignInForm } from "@/lib/auth";
import styles from "@/app/auth-page.module.css";

export default function SignInPage() {
  return (
    <div className={styles.root}>
      <div className={styles.frame}>
        <SignInForm />
      </div>
    </div>
  );
}
