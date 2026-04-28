import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const notFoundError = new Error("NEXT_NOT_FOUND");
(globalThis as { React?: typeof React }).React = React;

const mocks = vi.hoisted(() => ({
  isLocalFixturePreviewEnabled: vi.fn(),
  notFound: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  notFound: mocks.notFound,
}));

vi.mock("@/lib/shared/demo-mode", () => ({
  isLocalFixturePreviewEnabled: mocks.isLocalFixturePreviewEnabled,
}));

vi.mock("@/features/settings/components/SettingsOverview", () => ({
  SettingsOverview: () => null,
}));

import DevSettingsPreviewPage, { dynamic } from "@/app/dev/settings-preview/page";

describe("dev settings preview page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.notFound.mockImplementation(() => {
      throw notFoundError;
    });
  });

  it("is rendered dynamically per request", () => {
    expect(dynamic).toBe("force-dynamic");
  });

  it("blocks access when the local preview guard is off", () => {
    mocks.isLocalFixturePreviewEnabled.mockReturnValue(false);

    expect(() => DevSettingsPreviewPage()).toThrow(notFoundError);
  });

  it("renders the settings UI with fake account data when the guard is on", () => {
    mocks.isLocalFixturePreviewEnabled.mockReturnValue(true);

    expect(DevSettingsPreviewPage()).toBeTruthy();
  });
});
