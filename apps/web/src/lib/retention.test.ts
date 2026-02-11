import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  dbExecute: vi.fn(),
}));

vi.mock("@/lib/database", () => ({
  db: {
    execute: mocks.dbExecute,
  },
  sql: (strings: TemplateStringsArray, ...values: unknown[]) => ({
    strings: Array.from(strings),
    values,
  }),
}));

import {
  FEED_ITEMS_PER_FEED_LIMIT,
  purgeOldFeedItemsForFeed,
  purgeOldFeedItemsForUser,
} from "@/lib/retention";

describe("retention helpers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 0 when no user-owned rows exceed the per-feed cap", async () => {
    mocks.dbExecute.mockResolvedValue({ rows: [] });

    const deletedCount = await purgeOldFeedItemsForUser("user_123");

    expect(deletedCount).toBe(0);
    expect(mocks.dbExecute).toHaveBeenCalledTimes(1);
    expect(mocks.dbExecute.mock.calls[0][0]?.values).toEqual([
      "user_123",
      FEED_ITEMS_PER_FEED_LIMIT,
    ]);
  });

  it("returns deleted row count when user-wide prune removes over-limit items", async () => {
    mocks.dbExecute.mockResolvedValue({
      rows: [{ id: "item_a" }, { id: "item_b" }, { id: "item_c" }],
    });

    const deletedCount = await purgeOldFeedItemsForUser("user_123");

    expect(deletedCount).toBe(3);
  });

  it("feed-scoped prune is ownership-scoped and safely returns 0 for missing/non-owned feeds", async () => {
    mocks.dbExecute.mockResolvedValue({ rows: [] });

    const deletedCount = await purgeOldFeedItemsForFeed({
      userId: "user_123",
      feedId: "feed_404",
    });

    expect(deletedCount).toBe(0);
    expect(mocks.dbExecute).toHaveBeenCalledTimes(1);
    expect(mocks.dbExecute.mock.calls[0][0]?.values).toEqual([
      "user_123",
      "feed_404",
      FEED_ITEMS_PER_FEED_LIMIT,
    ]);
    expect(mocks.dbExecute.mock.calls[0][0]?.strings.join("")).toContain("f.user_id");
    expect(mocks.dbExecute.mock.calls[0][0]?.strings.join("")).toContain("fi.feed_id");
  });

  it("supports rowCount-based delete responses", async () => {
    mocks.dbExecute.mockResolvedValue({ rowCount: 2 });

    const deletedCount = await purgeOldFeedItemsForFeed({
      userId: "user_123",
      feedId: "feed_123",
    });

    expect(deletedCount).toBe(2);
  });
});
