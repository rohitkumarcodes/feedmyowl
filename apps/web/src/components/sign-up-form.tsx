"use client";

import { useState } from "react";
import { useSignUp } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import Link from "next/link";
import styles from "@/app/auth-form.module.css";

const REQUIREMENT_LABELS: Record<string, string> = {
  emailAddress: "email address",
  phoneNumber: "phone number",
  firstName: "first name",
  lastName: "last name",
  username: "username",
  legalAccepted: "terms acceptance",
};

function formatRequirement(field: string): string {
  const explicitLabel = REQUIREMENT_LABELS[field];
  if (explicitLabel) {
    return explicitLabel;
  }

  return field
    .replace(/_/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .toLowerCase();
}

export function SignUpForm() {
  const { isLoaded, signUp, setActive } = useSignUp();
  const router = useRouter();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
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
      const trimmedFirstName = firstName.trim();
      const trimmedLastName = lastName.trim();
      const result = await signUp.create({
        emailAddress: email,
        password,
        ...(trimmedFirstName ? { firstName: trimmedFirstName } : {}),
        ...(trimmedLastName ? { lastName: trimmedLastName } : {}),
      });

      if (result.status === "complete") {
        await setActive({ session: result.createdSessionId });
        router.push("/feeds");
      } else if (result.status === "missing_requirements") {
        try {
          await result.prepareEmailAddressVerification({
            strategy: "email_code",
          });
          setIsVerifyingEmail(true);
          setInfo("We sent a verification code to your email.");
          return;
        } catch {
          try {
            await result.prepareEmailAddressVerification({
              strategy: "email_link",
              redirectUrl: `${window.location.origin}/sign-in`,
            });
            setInfo("We sent a verification link to your email.");
            return;
          } catch {
            const missingFields = result.missingFields ?? [];
            const unverifiedFields = result.unverifiedFields ?? [];

            if (missingFields.length > 0) {
              const missing = missingFields.map(formatRequirement).join(", ");
              setError(`Sign up needs additional fields: ${missing}.`);
              return;
            }

            if (unverifiedFields.length > 0) {
              const unverified = unverifiedFields.map(formatRequirement).join(", ");
              setError(`Sign up still needs verification for: ${unverified}.`);
              return;
            }

            const strategies = result.verifications.emailAddress.supportedStrategies;
            const supportedStrategies = strategies.length > 0 ? strategies.join(", ") : "none";
            setError(
              `Email verification is not enabled for this sign up flow (supported strategies: ${supportedStrategies}).`,
            );
            return;
          }
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
              <label className={styles.label} htmlFor="first-name">
                First name (optional)
              </label>
              <div className={styles.inputWrapper}>
                <input
                  id="first-name"
                  type="text"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  className={styles.input}
                  placeholder="Your first name"
                  autoComplete="given-name"
                />
              </div>
            </div>

            <div className={styles.fieldGroup}>
              <label className={styles.label} htmlFor="last-name">
                Last name (optional)
              </label>
              <div className={styles.inputWrapper}>
                <input
                  id="last-name"
                  type="text"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  className={styles.input}
                  placeholder="Your last name"
                  autoComplete="family-name"
                />
              </div>
            </div>

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
