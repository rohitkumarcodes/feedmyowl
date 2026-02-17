"use client";

import { useState } from "react";
import { useSignUp } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import Link from "next/link";
import styles from "@/app/auth-form.module.css";

export function SignUpForm() {
  const { isLoaded, signUp, setActive } = useSignUp();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [isVerifyingEmail, setIsVerifyingEmail] = useState(false);
  const [info, setInfo] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleCreateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setInfo("");
    setError("");
    setIsLoading(true);

    if (!isLoaded) {
      setIsLoading(false);
      return;
    }

    try {
      const result = await signUp.create({
        emailAddress: email,
        password,
      });

      if (result.status === "complete") {
        await setActive({ session: result.createdSessionId });
        router.push("/feeds");
      } else if (result.status === "missing_requirements") {
        const strategies = result.verifications.emailAddress.supportedStrategies;

        if (strategies.includes("email_code")) {
          await result.prepareEmailAddressVerification({
            strategy: "email_code",
          });
          setIsVerifyingEmail(true);
          setInfo("We sent a verification code to your email.");
        } else if (strategies.includes("email_link")) {
          await result.prepareEmailAddressVerification({
            strategy: "email_link",
            redirectUrl: `${window.location.origin}/sign-in`,
          });
          setInfo("We sent a verification link to your email.");
        } else {
          setError("Account created, but email verification is unavailable.");
        }
      } else {
        setError("Account created, but more verification is required.");
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Something went wrong";
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setInfo("");
    setError("");
    setIsLoading(true);

    if (!isLoaded || !signUp) {
      setIsLoading(false);
      return;
    }

    try {
      const result = await signUp.attemptEmailAddressVerification({
        code: verificationCode,
      });

      if (result.status === "complete") {
        await setActive({ session: result.createdSessionId });
        router.push("/feeds");
      } else {
        setError("Verification did not complete. Please try the code again.");
      }
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Unable to verify code right now";
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <form
        className={styles.form}
        onSubmit={isVerifyingEmail ? handleVerifyEmail : handleCreateAccount}
      >
        {isVerifyingEmail ? (
          <div className={styles.fieldGroup}>
            <label className={styles.label} htmlFor="verification-code">
              Verification code
            </label>
            <div className={styles.inputWrapper}>
              <input
                id="verification-code"
                type="text"
                value={verificationCode}
                onChange={(e) => setVerificationCode(e.target.value)}
                className={styles.input}
                placeholder="Enter the code from your email"
                required
                autoComplete="one-time-code"
                inputMode="numeric"
              />
            </div>
          </div>
        ) : (
          <>
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
              <label className={styles.label} htmlFor="password">
                Password
              </label>
              <div className={styles.inputWrapper}>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={styles.input}
                  placeholder="Create a password"
                  required
                  autoComplete="new-password"
                  minLength={8}
                />
              </div>
            </div>
          </>
        )}

        {info && <p className={styles.info}>{info}</p>}
        {error && <p className={styles.error}>{error}</p>}

        <button type="submit" className={styles.submitButton} disabled={isLoading}>
          {isVerifyingEmail
            ? isLoading
              ? "Verifying..."
              : "Verify email"
            : isLoading
              ? "Creating account..."
              : "Create account"}
        </button>
      </form>
      {isVerifyingEmail && (
        <div className={styles.footer}>
          <span className={styles.footerText}>Wrong email? </span>
          <button
            type="button"
            className={styles.actionLink}
            onClick={() => {
              setIsVerifyingEmail(false);
              setVerificationCode("");
              setInfo("");
              setError("");
            }}
          >
            Start over
          </button>
        </div>
      )}
      {!isVerifyingEmail && (
        <div className={styles.footer}>
          <span className={styles.footerText}>Already have an account? </span>
          <Link href="/sign-in" className={styles.footerLink}>
            Sign in
          </Link>
        </div>
      )}
    </>
  );
}
