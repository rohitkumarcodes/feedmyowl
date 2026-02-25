"use client";

import { useState } from "react";
import { useSignIn } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import Link from "next/link";
import styles from "@/app/auth-form.module.css";
import {
  getClerkSignInErrorMessage,
  getIncompleteSignInMessage,
} from "@/components/sign-in-form-utils";

export function SignInForm() {
  const { isLoaded, signIn, setActive } = useSignIn();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    if (!isLoaded || !signIn || !setActive) {
      setError("Sign-in is still loading. Refresh the page and try again.");
      setIsLoading(false);
      return;
    }

    const activateSessionAndRedirect = async (sessionId: string | null | undefined) => {
      if (!sessionId) {
        setError("Sign-in succeeded but no session was created. Please try again.");
        return;
      }

      await setActive({ session: sessionId });
      router.push("/feeds");
    };

    try {
      const result = await signIn.create({
        identifier: email,
        password,
      });

      if (result.status === "complete") {
        await activateSessionAndRedirect(result.createdSessionId);
        return;
      }

      if (result.status === "needs_first_factor") {
        const firstFactorAttempt = await result.attemptFirstFactor({
          strategy: "password",
          password,
        });

        if (firstFactorAttempt.status === "complete") {
          await activateSessionAndRedirect(firstFactorAttempt.createdSessionId);
          return;
        }

        setError(getIncompleteSignInMessage(firstFactorAttempt.status));
        return;
      }

      setError(getIncompleteSignInMessage(result.status));
    } catch (err: unknown) {
      setError(getClerkSignInErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <form className={styles.form} onSubmit={handleSubmit}>
        <div className={styles.fieldGroup}>
          <label className={styles.label} htmlFor="email">
            Email
          </label>
          <div className={styles.inputWrapper}>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={styles.input}
              placeholder="you@example.com"
              required
              autoComplete="email"
            />
          </div>
        </div>

        <div className={styles.fieldGroup}>
          <div className={styles.labelRow}>
            <label className={styles.label} htmlFor="password">
              Password
            </label>
            <a href="/forgot-password" className={styles.actionLink}>
              Forgot password?
            </a>
          </div>
          <div className={styles.inputWrapper}>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={styles.input}
              placeholder="Enter your password"
              required
              autoComplete="current-password"
            />
          </div>
        </div>

        {error && <p className={styles.error}>{error}</p>}

        <button
          type="submit"
          className={styles.submitButton}
          disabled={isLoading || !isLoaded}
        >
          {isLoading ? "Signing in..." : !isLoaded ? "Loading..." : "Sign in"}
        </button>
      </form>
      <div className={styles.footer}>
        <span className={styles.footerText}>Don&apos;t have an account? </span>
        <Link href="/sign-up" className={styles.footerLink}>
          Sign up
        </Link>
      </div>
    </>
  );
}
