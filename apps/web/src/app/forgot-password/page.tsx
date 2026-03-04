import { redirect } from "next/navigation";
import { getAuthUserId } from "@/lib/server/auth";
import { ForgotPasswordForm } from "@/components/forgot-password-form";
import styles from "@/app/auth-page.module.css";

/**
 * This page reads auth state at request time — never statically prerender.
 */
export const dynamic = "force-dynamic";

export default async function ForgotPasswordPage() {
  const userId = await getAuthUserId();
  if (userId) {
    redirect("/feeds");
  }

  return (
    <div className={styles.root}>
      <div className={styles.frame}>
        <div className={styles.header}>
          <h1 className={styles.title}>Reset password</h1>
          <p className={styles.subtitle}>We&apos;ll send a verification code to your email.</p>
        </div>
        <ForgotPasswordForm />
      </div>
    </div>
  );
}
