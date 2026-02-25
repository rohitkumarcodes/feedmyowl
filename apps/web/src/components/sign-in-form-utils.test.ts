import { describe, expect, it } from "vitest";
import {
  getClerkSignInErrorMessage,
  getSecondFactorCodeInputLabel,
  getSecondFactorInstructionMessage,
  pickPreferredSecondFactorOption,
  toSecondFactorOptions,
  getIncompleteSignInMessage,
} from "@/components/sign-in-form-utils";

describe("getClerkSignInErrorMessage", () => {
  it("prefers Clerk longMessage when available", () => {
    const message = getClerkSignInErrorMessage({
      errors: [{ longMessage: "Email address is not valid." }],
    });

    expect(message).toBe("Email address is not valid.");
  });

  it("falls back to top-level message", () => {
    const message = getClerkSignInErrorMessage({
      message: "Authentication failed",
    });

    expect(message).toBe("Authentication failed");
  });

  it("returns fallback when no useful message exists", () => {
    const message = getClerkSignInErrorMessage({ errors: [{}] });

    expect(message).toBe("Invalid email or password");
  });
});

describe("getIncompleteSignInMessage", () => {
  it("returns an MFA hint for needs_second_factor status", () => {
    expect(getIncompleteSignInMessage("needs_second_factor")).toContain(
      "second verification step",
    );
  });

  it("returns a generic message for unknown statuses", () => {
    expect(getIncompleteSignInMessage("pending")).toBe(
      "Sign-in could not be completed. Please try again.",
    );
  });
});

describe("second factor helpers", () => {
  it("sorts and normalizes supported second factors by priority", () => {
    const options = toSecondFactorOptions([
      {
        strategy: "backup_code",
      },
      {
        strategy: "phone_code",
        safeIdentifier: "***1234",
        phoneNumberId: "pn_123",
      },
      {
        strategy: "totp",
      },
    ]);

    expect(options.map((option) => option.strategy)).toEqual([
      "totp",
      "phone_code",
      "backup_code",
    ]);
    expect(options[1]).toMatchObject({
      strategy: "phone_code",
      safeIdentifier: "***1234",
      phoneNumberId: "pn_123",
    });
  });

  it("returns null preferred option when none are available", () => {
    expect(pickPreferredSecondFactorOption([])).toBeNull();
  });

  it("labels backup code input correctly", () => {
    const label = getSecondFactorCodeInputLabel({
      strategy: "backup_code",
    });

    expect(label).toBe("Backup code");
  });

  it("builds readable instructions for email code factors", () => {
    const message = getSecondFactorInstructionMessage({
      strategy: "email_code",
      safeIdentifier: "r***@example.com",
    });

    expect(message).toContain("r***@example.com");
  });
});
