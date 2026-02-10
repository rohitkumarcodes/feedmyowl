import { describe, expect, it, vi } from "vitest";
import { buildSidebarNotices } from "./sidebar-messages";

describe("sidebar-messages", () => {
  it("maps all message kinds with semantic roles and order", () => {
    const onAddAnother = vi.fn();
    const notices = buildSidebarNotices({
      addFeedProgressMessage: "Adding feed 2 of 10...",
      networkMessage: "You’re offline. You can still read cached articles.",
      infoMessage: "Feed added. Added to Uncategorized.",
      errorMessage: "Could not connect to the server.",
      showAddAnotherAction: true,
      onAddAnother,
    });

    expect(notices.map((notice) => notice.kind)).toEqual([
      "progress",
      "offline",
      "info",
      "error",
    ]);

    expect(notices[0]).toMatchObject({
      role: "status",
      ariaLive: "polite",
      dismissible: false,
    });
    expect(notices[1]).toMatchObject({
      role: "status",
      ariaLive: "polite",
      dismissible: false,
    });
    expect(notices[2]).toMatchObject({
      role: "status",
      ariaLive: "polite",
      dismissible: true,
    });
    expect(notices[2].action?.label).toBe("Add another");
    expect(notices[3]).toMatchObject({
      role: "alert",
      ariaLive: "assertive",
      dismissible: true,
    });
  });

  it("omits actionable info action when no follow-up action is available", () => {
    const notices = buildSidebarNotices({
      addFeedProgressMessage: null,
      networkMessage: null,
      infoMessage: "Refresh complete.",
      errorMessage: null,
      showAddAnotherAction: false,
      onAddAnother: vi.fn(),
    });

    expect(notices).toHaveLength(1);
    expect(notices[0].kind).toBe("info");
    expect(notices[0].action).toBeUndefined();
  });

  it("returns an empty list when no messages are present", () => {
    const notices = buildSidebarNotices({
      addFeedProgressMessage: null,
      networkMessage: null,
      infoMessage: null,
      errorMessage: null,
      showAddAnotherAction: false,
      onAddAnother: vi.fn(),
    });

    expect(notices).toEqual([]);
  });
});
