"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useSignIn } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import styles from "@/app/auth-form.module.css";
import {
  getClerkSignInErrorMessage,
  getIncompleteSignInMessage,
} from "@/components/sign-in-form-utils";

type ResetStep = "request" | "verify";

export function ForgotPasswordForm() {
  const { isLoaded, signIn, setActive } = useSignIn();
  const router = useRouter();
  const [step, setStep] = useState<ResetStep>("request");
  const [email, setEmail] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [info, setInfo] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const isAuthReady = isLoaded && Boolean(signIn) && Boolean(setActive);

  const startOver = () => {
    setStep("request");
    setVerificationCode("");
    setNewPassword("");
    setInfo("");
    setError("");
  };

  const requestResetCode = async (event: React.FormEvent) => {
    event.preventDefault();
    setInfo("");
    setError("");
    setIsLoading(true);

    if (!isAuthReady || !signIn) {
      setError("Password reset is still loading. Refresh the page and try again.");
      setIsLoading(false);
      return;
    }

    try {
      const requestResult = await signIn.create({
        strategy: "reset_password_email_code",
        identifier: email.trim(),
      });

      if (requestResult.status === "needs_first_factor") {
        setStep("verify");
        setInfo("We sent a verification code to your email.");
        return;
      }

      if (requestResult.status === "complete") {
        if (!requestResult.createdSessionId || !setActive) {
          setError("Password reset succeeded but no session was created.");
          return;
        }
        await setActive({ session: requestResult.createdSessionId });
        router.push("/feeds");
        return;
      }

      setError(getIncompleteSignInMessage(requestResult.status));
    } catch (caughtError: unknown) {
      setError(getClerkSignInErrorMessage(caughtError, "Could not start password reset."));
    } finally {
      setIsLoading(false);
    }
  };

  const submitReset = async (event: React.FormEvent) => {
    event.preventDefault();
    setInfo("");
    setError("");
    setIsLoading(true);

    if (!isAuthReady || !signIn || !setActive) {
      setError("Password reset is still loading. Refresh the page and try again.");
      setIsLoading(false);
      return;
    }

    const trimmedCode = verificationCode.trim();
    if (!trimmedCode) {
      setError("Enter the verification code.");
      setIsLoading(false);
      return;
    }

    try {
      const attemptResult = await signIn.attemptFirstFactor({
        strategy: "reset_password_email_code",
        code: trimmedCode,
        password: newPassword,
      });

      if (attemptResult.status === "complete") {
        if (!attemptResult.createdSessionId) {
          setError("Password reset succeeded but no session was created.");
          return;
        }
        await setActive({ session: attemptResult.createdSessionId });
        router.push("/feeds");
        return;
      }

      if (attemptResult.status === "needs_first_factor") {
        setError("That reset code was not accepted. Please try again.");
        return;
      }

      setError(getIncompleteSignInMessage(attemptResult.status));
    } catch (caughtError: unknown) {
      setError(getClerkSignInErrorMessage(caughtError, "Could not reset password."));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <form
        className={styles.form}
        onSubmit={step === "request" ? requestResetCode : submitReset}
      >
        {step === "request" ? (
          <div className={styles.fieldGroup}>
            <label className={styles.label} htmlFor="email">
              Email
            </label>
            <div className={styles.inputWrapper}>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.currentTarget.value)}
                className={styles.input}
                placeholder="you@example.com"
                required
                autoComplete="email"
              />
            </div>
          </div>
        ) : (
          <>
            <div className={styles.fieldGroup}>
              <label className={styles.label} htmlFor="verification-code">
                Verification code
              </label>
              <div className={styles.inputWrapper}>
                <input
                  id="verification-code"
                  type="text"
                  value={verificationCode}
                  onChange={(event) => setVerificationCode(event.currentTarget.value)}
                  className={styles.input}
                  placeholder="Enter code"
                  required
                  autoComplete="one-time-code"
                />
              </div>
            </div>
            <div className={styles.fieldGroup}>
              <label className={styles.label} htmlFor="new-password">
                New password
              </label>
              <div className={styles.inputWrapper}>
                <input
                  id="new-password"
                  type="password"
                  value={newPassword}
                  onChange={(event) => setNewPassword(event.currentTarget.value)}
                  className={styles.input}
                  placeholder="Create a new password"
                  required
                  minLength={8}
                  autoComplete="new-password"
                />
              </div>
            </div>
          </>
        )}

        {info ? <p className={styles.info}>{info}</p> : null}
        {error ? <p className={styles.error}>{error}</p> : null}

        <button
          type="submit"
          className={styles.submitButton}
          disabled={isLoading || !isAuthReady}
        >
          {step === "request"
            ? isLoading
              ? "Sending code..."
              : !isAuthReady
                ? "Loading..."
                : "Send reset code"
            : isLoading
              ? "Resetting password..."
              : !isAuthReady
                ? "Loading..."
                : "Reset password"}
        </button>
      </form>

      <div className={styles.footer}>
        {step === "verify" ? (
          <>
            <span className={styles.footerText}>Need a new code? </span>
            <button type="button" className={styles.actionLink} onClick={startOver}>
              Start over
            </button>
          </>
        ) : (
          <>
            <span className={styles.footerText}>Remembered your password? </span>
            <Link href="/sign-in" className={styles.footerLink}>
              Sign in
            </Link>
          </>
        )}
      </div>
    </>
  );
}
