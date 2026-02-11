import { afterEach, describe, expect, it } from "vitest";
import { getTrustedOrigins } from "@/lib/trusted-origins";

const originalEnv = { ...process.env };

afterEach(() => {
  process.env = { ...originalEnv };
});

describe("trusted origins", () => {
  it("returns localhost and app defaults", () => {
    delete process.env.NEXT_PUBLIC_APP_URL;
    delete process.env.VERCEL_URL;

    const origins = getTrustedOrigins();

    expect(origins).toContain("http://localhost:3000");
    expect(origins).toContain("http://127.0.0.1:3000");
    expect(origins).toContain("https://app.feedmyowl.com");
  });

  it("includes configured app and preview origins", () => {
    process.env.NEXT_PUBLIC_APP_URL = "https://custom-app.feedmyowl.dev";
    process.env.VERCEL_URL = "preview.feedmyowl.vercel.app";

    const origins = getTrustedOrigins();

    expect(origins).toContain("https://custom-app.feedmyowl.dev");
    expect(origins).toContain("https://preview.feedmyowl.vercel.app");
  });
});
