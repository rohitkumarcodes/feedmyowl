import { describe, expect, it } from "vitest";
import {
  getClerkSignInErrorMessage,
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
