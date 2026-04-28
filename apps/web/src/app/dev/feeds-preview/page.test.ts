import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const notFoundError = new Error("NEXT_NOT_FOUND");
(globalThis as { React?: typeof React }).React = React;

const mocks = vi.hoisted(() => ({
  isLocalFixturePreviewEnabled: vi.fn(),
  notFound: vi.fn(),
  getDemoFeeds: vi.fn(),
  getDemoFolders: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  notFound: mocks.notFound,
}));

vi.mock("@/lib/shared/demo-mode", () => ({
  isLocalFixturePreviewEnabled: mocks.isLocalFixturePreviewEnabled,
}));

vi.mock("@/lib/server/demo-data", () => ({
  getDemoFeeds: mocks.getDemoFeeds,
  getDemoFolders: mocks.getDemoFolders,
}));

vi.mock("@/features/feeds/components/FeedsWorkspace", () => ({
  FeedsWorkspace: () => null,
}));

import DevFeedsPreviewPage, { dynamic } from "@/app/dev/feeds-preview/page";

describe("dev feeds preview page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.notFound.mockImplementation(() => {
      throw notFoundError;
    });
    mocks.getDemoFeeds.mockReturnValue([{ id: "fake-feed" }]);
    mocks.getDemoFolders.mockReturnValue([{ id: "fake-folder" }]);
  });

  it("is rendered dynamically per request", () => {
    expect(dynamic).toBe("force-dynamic");
  });

  it("blocks access when the local preview guard is off", () => {
    mocks.isLocalFixturePreviewEnabled.mockReturnValue(false);

    expect(() => DevFeedsPreviewPage()).toThrow(notFoundError);
    expect(mocks.getDemoFeeds).not.toHaveBeenCalled();
  });

  it("renders the workspace with fake fixture data when the guard is on", () => {
    mocks.isLocalFixturePreviewEnabled.mockReturnValue(true);

    const page = DevFeedsPreviewPage();

    expect(page).toBeTruthy();
    expect(mocks.getDemoFeeds).toHaveBeenCalledOnce();
    expect(mocks.getDemoFolders).toHaveBeenCalledOnce();
  });
});
