"use client";

import { useState } from "react";
import { useSignIn } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import Link from "next/link";
import styles from "@/app/auth-form.module.css";
import {
  getClerkSignInErrorMessage,
  getIncompleteSignInMessage,
  getSecondFactorCodeInputLabel,
  getSecondFactorDeliveryMessage,
  getSecondFactorInstructionMessage,
  isCodeBasedSecondFactor,
  isSecondFactorRequiredError,
  pickPreferredSecondFactorOption,
  toSecondFactorOptions,
  type SecondFactorOption,
} from "@/components/sign-in-form-utils";

export function SignInForm() {
  const { isLoaded, signIn, setActive } = useSignIn();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [secondFactorOption, setSecondFactorOption] = useState<SecondFactorOption | null>(
    null,
  );
  const [info, setInfo] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const isSecondFactorStep = secondFactorOption !== null;
  const codeBasedSecondFactor =
    secondFactorOption !== null && isCodeBasedSecondFactor(secondFactorOption.strategy);

  const resetSecondFactorStep = () => {
    setSecondFactorOption(null);
    setVerificationCode("");
    setInfo("");
    setError("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setInfo("");
    setIsLoading(true);

    if (!isLoaded || !signIn || !setActive) {
      setError("Sign-in is still loading. Refresh the page and try again.");
      setIsLoading(false);
      return;
    }

    const readySignIn = signIn;
    const readySetActive = setActive;

    const activateSessionAndRedirect = async (sessionId: string | null | undefined) => {
      if (!sessionId) {
        setError("Sign-in succeeded but no session was created. Please try again.");
        return;
      }

      await readySetActive({ session: sessionId });
      router.push("/feeds");
    };

    const prepareSecondFactor = async (
      signInResource: typeof readySignIn,
      option: SecondFactorOption,
    ) => {
      if (option.strategy === "phone_code") {
        await signInResource.prepareSecondFactor({
          strategy: "phone_code",
          ...(option.phoneNumberId ? { phoneNumberId: option.phoneNumberId } : {}),
        });
        setInfo(getSecondFactorDeliveryMessage(option));
        return;
      }

      if (option.strategy === "email_code") {
        await signInResource.prepareSecondFactor({
          strategy: "email_code",
          ...(option.emailAddressId ? { emailAddressId: option.emailAddressId } : {}),
        });
        setInfo(getSecondFactorDeliveryMessage(option));
        return;
      }

      if (option.strategy === "email_link") {
        if (!option.emailAddressId) {
          setError(
            "Email-link verification is not fully configured for this account. Use another sign-in method.",
          );
          return;
        }

        await signInResource.prepareSecondFactor({
          strategy: "email_link",
          emailAddressId: option.emailAddressId,
          redirectUrl: `${window.location.origin}/sign-in`,
        });
        setInfo(getSecondFactorDeliveryMessage(option));
        return;
      }

      setInfo(getSecondFactorInstructionMessage(option));
    };

    const beginSecondFactorStep = async (signInResource: typeof readySignIn) => {
      const options = toSecondFactorOptions(signInResource.supportedSecondFactors);
      const preferredOption = pickPreferredSecondFactorOption(options);

      if (!preferredOption) {
        setError(
          "This account requires a second verification step, but no supported method was found.",
        );
        return;
      }

      setSecondFactorOption(preferredOption);
      setVerificationCode("");
      await prepareSecondFactor(signInResource, preferredOption);
    };

    const attemptPrimarySignIn = async () => {
      const result = await readySignIn.create({
        strategy: "password",
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

        if (firstFactorAttempt.status === "needs_second_factor") {
          await beginSecondFactorStep(firstFactorAttempt);
          return;
        }

        setError(getIncompleteSignInMessage(firstFactorAttempt.status));
        return;
      }

      if (result.status === "needs_second_factor") {
        await beginSecondFactorStep(result);
        return;
      }

      setError(getIncompleteSignInMessage(result.status));
    };

    const attemptSecondFactorSignIn = async () => {
      if (!secondFactorOption) {
        setError("Second-factor verification is not initialized. Please sign in again.");
        return;
      }

      if (!isCodeBasedSecondFactor(secondFactorOption.strategy)) {
        await prepareSecondFactor(readySignIn, secondFactorOption);
        return;
      }

      const trimmedCode = verificationCode.trim();
      if (!trimmedCode) {
        setError(
          secondFactorOption.strategy === "backup_code"
            ? "Enter one of your backup codes."
            : "Enter the verification code.",
        );
        return;
      }

      const secondFactorAttempt =
        secondFactorOption.strategy === "totp"
          ? await readySignIn.attemptSecondFactor({ strategy: "totp", code: trimmedCode })
          : secondFactorOption.strategy === "backup_code"
            ? await readySignIn.attemptSecondFactor({
                strategy: "backup_code",
                code: trimmedCode,
              })
            : secondFactorOption.strategy === "email_code"
              ? await readySignIn.attemptSecondFactor({
                  strategy: "email_code",
                  code: trimmedCode,
                })
              : await readySignIn.attemptSecondFactor({
                  strategy: "phone_code",
                  code: trimmedCode,
                });

      if (secondFactorAttempt.status === "complete") {
        await activateSessionAndRedirect(secondFactorAttempt.createdSessionId);
        return;
      }

      if (secondFactorAttempt.status === "needs_second_factor") {
        setError(
          secondFactorOption.strategy === "backup_code"
            ? "That backup code was not accepted. Try another one."
            : "That verification code was not accepted. Please try again.",
        );
        return;
      }

      setError(getIncompleteSignInMessage(secondFactorAttempt.status));
    };

    try {
      if (isSecondFactorStep) {
        await attemptSecondFactorSignIn();
      } else {
        try {
          await attemptPrimarySignIn();
        } catch (error) {
          if (
            isSecondFactorRequiredError(error) ||
            readySignIn.status === "needs_second_factor"
          ) {
            await beginSecondFactorStep(readySignIn);
            return;
          }
          throw error;
        }
      }
    } catch (err: unknown) {
      setError(getClerkSignInErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <form className={styles.form} onSubmit={handleSubmit}>
        {isSecondFactorStep ? (
          codeBasedSecondFactor ? (
            <div className={styles.fieldGroup}>
              <label className={styles.label} htmlFor="verification-code">
                {secondFactorOption
                  ? getSecondFactorCodeInputLabel(secondFactorOption)
                  : "Verification code"}
              </label>
              <div className={styles.inputWrapper}>
                <input
                  id="verification-code"
                  type="text"
                  value={verificationCode}
                  onChange={(event) => setVerificationCode(event.target.value)}
                  className={styles.input}
                  placeholder={
                    secondFactorOption?.strategy === "backup_code"
                      ? "Enter backup code"
                      : "Enter verification code"
                  }
                  required
                  autoComplete="one-time-code"
                />
              </div>
            </div>
          ) : null
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
                  onChange={(event) => setEmail(event.target.value)}
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
                <Link href="/forgot-password" className={styles.actionLink}>
                  Forgot password?
                </Link>
              </div>
              <div className={styles.inputWrapper}>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className={styles.input}
                  placeholder="Enter your password"
                  required
                  autoComplete="current-password"
                />
              </div>
            </div>
          </>
        )}

        {secondFactorOption && (
          <p className={styles.info}>
            {getSecondFactorInstructionMessage(secondFactorOption)}
          </p>
        )}
        {info && <p className={styles.info}>{info}</p>}
        {error && <p className={styles.error}>{error}</p>}

        <button
          type="submit"
          className={styles.submitButton}
          disabled={isLoading || !isLoaded || !signIn || !setActive}
        >
          {isLoading
            ? isSecondFactorStep
              ? "Verifying..."
              : "Signing in..."
            : isSecondFactorStep
              ? codeBasedSecondFactor
                ? "Verify code"
                : "Send sign-in link"
              : !isLoaded
                ? "Loading..."
                : "Sign in"}
        </button>
      </form>
      {isSecondFactorStep ? (
        <div className={styles.footer}>
          <button
            type="button"
            className={styles.actionLink}
            onClick={resetSecondFactorStep}
          >
            Back to password sign-in
          </button>
        </div>
      ) : (
        <div className={styles.footer}>
          <span className={styles.footerText}>Don&apos;t have an account? </span>
          <Link href="/sign-up" className={styles.footerLink}>
            Sign up
          </Link>
        </div>
      )}
    </>
  );
}
