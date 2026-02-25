interface ClerkErrorEntry {
  longMessage?: string;
  message?: string;
}

interface ClerkErrorShape {
  errors?: ClerkErrorEntry[];
  message?: unknown;
}

export function getClerkSignInErrorMessage(
  error: unknown,
  fallback = "Invalid email or password",
): string {
  if (typeof error === "object" && error !== null) {
    const candidate = error as ClerkErrorShape;
    const firstError = candidate.errors?.[0];
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

export function getIncompleteSignInMessage(status: string | null | undefined): string {
  if (status === "needs_second_factor") {
    return "This account requires a second verification step before sign-in can finish.";
  }

  if (status === "needs_identifier") {
    return "Sign-in requires an identifier. Please enter your email address and try again.";
  }

  return "Sign-in could not be completed. Please try again.";
}
