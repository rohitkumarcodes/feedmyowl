import { describe, expect, it, vi } from "vitest";
import { buildSidebarNotices } from "./sidebar-messages";

describe("sidebar-messages", () => {
  it("maps all message kinds with semantic roles and order", () => {
    const notices = buildSidebarNotices({
      progressMessage: "Adding feed 2 of 10...",
      networkMessage: "You’re offline. You can still read cached articles.",
      queuedNotices: [
        {
          id: "success-1",
          kind: "success",
          text: "Feed added. Added to Uncategorized.",
          dismissible: true,
        },
        {
          id: "warning-1",
          kind: "warning",
          text: "Completed with issues: 2 succeeded, 1 need attention.",
          dismissible: true,
        },
        {
          id: "error-1",
          kind: "error",
          text: "Couldn't reach FeedMyOwl. Check your connection and try again.",
          dismissible: true,
        },
      ],
      showAddAnotherAction: true,
      onAddAnother: vi.fn(),
    });

    expect(notices.map((notice) => notice.kind)).toEqual([
      "progress",
      "offline",
      "success",
      "warning",
      "error",
    ]);

    expect(notices[0]).toMatchObject({
      id: "progress",
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
      id: "success-1",
      role: "status",
      ariaLive: "polite",
      dismissible: true,
    });
    expect(notices[2].action?.label).toBe("Add another");
    expect(notices[3]).toMatchObject({
      id: "warning-1",
      role: "status",
      ariaLive: "polite",
      dismissible: true,
    });
    expect(notices[4]).toMatchObject({
      id: "error-1",
      role: "alert",
      ariaLive: "assertive",
      dismissible: true,
    });
  });

  it("preserves queued order for newest-first stacked notices", () => {
    const notices = buildSidebarNotices({
      progressMessage: null,
      networkMessage: null,
      queuedNotices: [
        { id: "newest", kind: "info", text: "Newest", dismissible: true },
        { id: "older", kind: "error", text: "Older", dismissible: true },
      ],
      showAddAnotherAction: false,
      onAddAnother: vi.fn(),
    });

    expect(notices.map((notice) => notice.id)).toEqual(["newest", "older"]);
  });

  it("returns an empty list when no messages are present", () => {
    const notices = buildSidebarNotices({
      progressMessage: null,
      networkMessage: null,
      queuedNotices: [],
      showAddAnotherAction: false,
      onAddAnother: vi.fn(),
    });

    expect(notices).toEqual([]);
  });
});
