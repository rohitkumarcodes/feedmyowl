import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const redirectError = new Error("NEXT_REDIRECT");
(globalThis as { React?: typeof React }).React = React;

const mocks = vi.hoisted(() => ({
  getAuthUserId: vi.fn(),
  redirect: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  redirect: mocks.redirect,
}));

vi.mock("@/lib/server/auth", () => ({
  SignInForm: () => null,
  getAuthUserId: mocks.getAuthUserId,
  isAuthRequiredError: () => false,
}));

vi.mock("@/app/auth-page.module.css", () => ({
  default: {
    root: "root",
    frame: "frame",
  },
}));

import SignInPage, { dynamic } from "@/app/sign-in/[[...sign-in]]/page";

describe("sign-in page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.redirect.mockImplementation(() => {
      throw redirectError;
    });
  });

  it("is rendered dynamically per request", () => {
    expect(dynamic).toBe("force-dynamic");
  });

  it("redirects signed-in users to /feeds", async () => {
    mocks.getAuthUserId.mockResolvedValue("user_123");

    await expect(SignInPage()).rejects.toBe(redirectError);
    expect(mocks.redirect).toHaveBeenCalledWith("/feeds");
  });

  it("renders sign-in UI for signed-out users", async () => {
    mocks.getAuthUserId.mockResolvedValue(null);

    const page = await SignInPage();

    expect(page).toBeTruthy();
    expect(mocks.redirect).not.toHaveBeenCalled();
  });
});
