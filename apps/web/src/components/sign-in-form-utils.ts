interface ClerkErrorEntry {
  code?: string;
  longMessage?: string;
  message?: string;
}

interface ClerkErrorShape {
  errors?: ClerkErrorEntry[];
  message?: unknown;
}

export type SecondFactorStrategy =
  | "phone_code"
  | "totp"
  | "backup_code"
  | "email_code"
  | "email_link";

export interface SecondFactorOption {
  strategy: SecondFactorStrategy;
  safeIdentifier?: string;
  emailAddressId?: string;
  phoneNumberId?: string;
}

interface SecondFactorCandidate {
  strategy?: unknown;
  safeIdentifier?: unknown;
  emailAddressId?: unknown;
  phoneNumberId?: unknown;
}

const SECOND_FACTOR_PRIORITY: Record<SecondFactorStrategy, number> = {
  totp: 1,
  email_code: 2,
  phone_code: 3,
  backup_code: 4,
  email_link: 5,
};

function isSecondFactorStrategy(strategy: unknown): strategy is SecondFactorStrategy {
  return (
    strategy === "phone_code" ||
    strategy === "totp" ||
    strategy === "backup_code" ||
    strategy === "email_code" ||
    strategy === "email_link"
  );
}

function getClerkErrorEntries(error: unknown): ClerkErrorEntry[] {
  if (typeof error !== "object" || error === null) {
    return [];
  }

  const candidate = error as ClerkErrorShape;
  return Array.isArray(candidate.errors) ? candidate.errors : [];
}

export function getClerkSignInErrorMessage(
  error: unknown,
  fallback = "Invalid email or password",
): string {
  if (typeof error === "object" && error !== null) {
    const candidate = error as ClerkErrorShape;
    const firstError = getClerkErrorEntries(error)[0];
    const detailedMessage = firstError?.longMessage ?? firstError?.message;
    if (typeof detailedMessage === "string" && detailedMessage.trim().length > 0) {
      return detailedMessage;
    }

    if (typeof candidate.message === "string" && candidate.message.trim().length > 0) {
      return candidate.message;
    }
  }

  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }

  return fallback;
}

export function isSecondFactorRequiredError(error: unknown): boolean {
  const entries = getClerkErrorEntries(error);
  for (const entry of entries) {
    if (
      typeof entry.code === "string" &&
      /second[_-]?factor|needs_second_factor/i.test(entry.code)
    ) {
      return true;
    }

    const combinedMessage = `${entry.longMessage ?? ""} ${entry.message ?? ""}`.trim();
    if (/second verification step|second factor/i.test(combinedMessage)) {
      return true;
    }
  }

  if (
    error instanceof Error &&
    /second verification step|second factor/i.test(error.message)
  ) {
    return true;
  }

  return false;
}

export function toSecondFactorOptions(input: unknown): SecondFactorOption[] {
  if (!Array.isArray(input)) {
    return [];
  }

  const options: SecondFactorOption[] = [];

  for (const factor of input) {
    if (typeof factor !== "object" || factor === null) {
      continue;
    }

    const candidate = factor as SecondFactorCandidate;
    if (!isSecondFactorStrategy(candidate.strategy)) {
      continue;
    }

    options.push({
      strategy: candidate.strategy,
      safeIdentifier:
        typeof candidate.safeIdentifier === "string"
          ? candidate.safeIdentifier
          : undefined,
      emailAddressId:
        typeof candidate.emailAddressId === "string"
          ? candidate.emailAddressId
          : undefined,
      phoneNumberId:
        typeof candidate.phoneNumberId === "string" ? candidate.phoneNumberId : undefined,
    });
  }

  options.sort(
    (left, right) =>
      SECOND_FACTOR_PRIORITY[left.strategy] - SECOND_FACTOR_PRIORITY[right.strategy],
  );

  return options;
}

export function pickPreferredSecondFactorOption(
  options: SecondFactorOption[],
): SecondFactorOption | null {
  return options[0] ?? null;
}

export function isCodeBasedSecondFactor(strategy: SecondFactorStrategy): boolean {
  return strategy !== "email_link";
}

export function getSecondFactorCodeInputLabel(option: SecondFactorOption): string {
  if (option.strategy === "backup_code") {
    return "Backup code";
  }

  return "Verification code";
}

export function getSecondFactorInstructionMessage(option: SecondFactorOption): string {
  if (option.strategy === "totp") {
    return "Enter the code from your authenticator app.";
  }

  if (option.strategy === "backup_code") {
    return "Enter one of your backup codes.";
  }

  if (option.strategy === "email_code") {
    return option.safeIdentifier
      ? `Enter the code sent to ${option.safeIdentifier}.`
      : "Enter the code sent to your email.";
  }

  if (option.strategy === "phone_code") {
    return option.safeIdentifier
      ? `Enter the code sent to ${option.safeIdentifier}.`
      : "Enter the code sent to your phone.";
  }

  return option.safeIdentifier
    ? `Open the sign-in link sent to ${option.safeIdentifier}.`
    : "Open the sign-in link sent to your email.";
}

export function getSecondFactorDeliveryMessage(option: SecondFactorOption): string {
  if (option.strategy === "email_code") {
    return option.safeIdentifier
      ? `We sent a verification code to ${option.safeIdentifier}.`
      : "We sent a verification code to your email.";
  }

  if (option.strategy === "phone_code") {
    return option.safeIdentifier
      ? `We sent a verification code to ${option.safeIdentifier}.`
      : "We sent a verification code to your phone.";
  }

  if (option.strategy === "email_link") {
    return option.safeIdentifier
      ? `We sent a sign-in link to ${option.safeIdentifier}.`
      : "We sent a sign-in link to your email.";
  }

  return getSecondFactorInstructionMessage(option);
}

export function getIncompleteSignInMessage(status: string | null | undefined): string {
  if (status === "needs_identifier") {
    return "Sign-in requires an identifier. Please enter your email address and try again.";
  }

  if (status === "needs_second_factor") {
    return "A second verification step is required. Enter your verification code to continue.";
  }

  if (status === "needs_new_password") {
    return "A password reset is required before sign-in can finish.";
  }

  return "Sign-in could not be completed. Please try again.";
}
