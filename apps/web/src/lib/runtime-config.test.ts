import { afterEach, describe, expect, it } from "vitest";
import {
  getAppOrigin,
  getAppUrl,
  getLandingPageUrl,
  getVercelPreviewOrigin,
} from "@/lib/runtime-config";

const originalEnv = { ...process.env };

afterEach(() => {
  process.env = { ...originalEnv };
});

describe("runtime-config", () => {
  it("uses safe defaults when environment values are missing", () => {
    delete process.env.NEXT_PUBLIC_APP_URL;
    delete process.env.NEXT_PUBLIC_LANDING_PAGE_URL;
    delete process.env.VERCEL_URL;

    expect(getAppUrl()).toBe("https://app.feedmyowl.com");
    expect(getAppOrigin()).toBe("https://app.feedmyowl.com");
    expect(getLandingPageUrl()).toBe("https://feedmyowl.com");
    expect(getVercelPreviewOrigin()).toBeNull();
  });

  it("uses valid environment overrides", () => {
    process.env.NEXT_PUBLIC_APP_URL = "https://custom-app.feedmyowl.dev";
    process.env.NEXT_PUBLIC_LANDING_PAGE_URL = "https://custom-site.feedmyowl.dev";
    process.env.VERCEL_URL = "preview.feedmyowl.vercel.app";

    expect(getAppUrl()).toBe("https://custom-app.feedmyowl.dev/");
    expect(getAppOrigin()).toBe("https://custom-app.feedmyowl.dev");
    expect(getLandingPageUrl()).toBe("https://custom-site.feedmyowl.dev/");
    expect(getVercelPreviewOrigin()).toBe("https://preview.feedmyowl.vercel.app");
  });
});
