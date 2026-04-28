import { afterEach, describe, expect, it, vi } from "vitest";
import {
  canReachLocalFixturePreviewRoutes,
  isDemoModeEnabled,
  isLocalFixturePreviewEnabled,
} from "@/lib/shared/demo-mode";

const originalEnv = { ...process.env };

afterEach(() => {
  vi.unstubAllEnvs();
  process.env = { ...originalEnv };
});

describe("demo-mode guards", () => {
  it("keeps local fixture preview disabled by default", () => {
    delete process.env.FEEDMYOWL_DEV_PREVIEW;
    vi.stubEnv("NODE_ENV", "development");

    expect(isLocalFixturePreviewEnabled()).toBe(false);
  });

  it("enables local fixture preview only in next dev with an explicit flag", () => {
    vi.stubEnv("NODE_ENV", "development");
    process.env.FEEDMYOWL_DEV_PREVIEW = "1";
    delete process.env.VERCEL;
    delete process.env.VERCEL_ENV;

    expect(canReachLocalFixturePreviewRoutes()).toBe(true);
    expect(isLocalFixturePreviewEnabled()).toBe(true);
  });

  it("blocks local fixture preview in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    process.env.FEEDMYOWL_DEV_PREVIEW = "1";

    expect(canReachLocalFixturePreviewRoutes()).toBe(true);
    expect(isLocalFixturePreviewEnabled()).toBe(false);
  });

  it("blocks local fixture preview on Vercel Preview and Production", () => {
    vi.stubEnv("NODE_ENV", "development");
    process.env.FEEDMYOWL_DEV_PREVIEW = "1";
    process.env.VERCEL = "1";
    process.env.VERCEL_ENV = "preview";

    expect(canReachLocalFixturePreviewRoutes()).toBe(false);
    expect(isLocalFixturePreviewEnabled()).toBe(false);

    process.env.VERCEL_ENV = "production";

    expect(canReachLocalFixturePreviewRoutes()).toBe(false);
    expect(isLocalFixturePreviewEnabled()).toBe(false);
  });

  it("keeps legacy demo mode local-only so Vercel Preview still uses Clerk", () => {
    process.env.FEEDMYOWL_DEMO_MODE = "1";
    process.env.VERCEL = "1";
    process.env.VERCEL_ENV = "preview";

    expect(isDemoModeEnabled()).toBe(false);
  });
});
