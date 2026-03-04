// @vitest-environment jsdom

import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ForgotPasswordForm } from "@/components/forgot-password-form";

const routerPush = vi.fn();
const mockSetActive = vi.fn();
const mockCreate = vi.fn();
const mockAttemptFirstFactor = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: routerPush,
  }),
}));

vi.mock("@clerk/nextjs", () => ({
  useSignIn: () => ({
    isLoaded: true,
    signIn: {
      create: mockCreate,
      attemptFirstFactor: mockAttemptFirstFactor,
    },
    setActive: mockSetActive,
  }),
}));

describe("ForgotPasswordForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it("requests a reset code and moves to verification step", async () => {
    const user = userEvent.setup();
    mockCreate.mockResolvedValue({
      status: "needs_first_factor",
    });

    render(<ForgotPasswordForm />);

    await user.type(screen.getByLabelText("Email"), "reader@example.com");
    await user.click(screen.getByRole("button", { name: "Send reset code" }));

    await waitFor(() =>
      expect(mockCreate).toHaveBeenCalledWith({
        strategy: "reset_password_email_code",
        identifier: "reader@example.com",
      }),
    );

    expect(await screen.findByLabelText("Verification code")).toBeInTheDocument();
    expect(screen.getByLabelText("New password")).toBeInTheDocument();
    expect(screen.getByText("We sent a verification code to your email.")).toBeInTheDocument();
  });

  it("submits code + new password and redirects on success", async () => {
    const user = userEvent.setup();
    mockCreate.mockResolvedValue({
      status: "needs_first_factor",
    });
    mockAttemptFirstFactor.mockResolvedValue({
      status: "complete",
      createdSessionId: "sess_123",
    });

    render(<ForgotPasswordForm />);

    await user.type(screen.getByLabelText("Email"), "reader@example.com");
    await user.click(screen.getByRole("button", { name: "Send reset code" }));
    await screen.findByLabelText("Verification code");

    await user.type(screen.getByLabelText("Verification code"), "123456");
    await user.type(screen.getByLabelText("New password"), "new-password-123");
    await user.click(screen.getByRole("button", { name: "Reset password" }));

    await waitFor(() =>
      expect(mockAttemptFirstFactor).toHaveBeenCalledWith({
        strategy: "reset_password_email_code",
        code: "123456",
        password: "new-password-123",
      }),
    );
    await waitFor(() => expect(mockSetActive).toHaveBeenCalledWith({ session: "sess_123" }));
    await waitFor(() => expect(routerPush).toHaveBeenCalledWith("/feeds"));
  });
});
