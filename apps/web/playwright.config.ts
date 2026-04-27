import { defineConfig, devices } from "@playwright/test";

const port = Number(process.env.PORT ?? 3107);
const baseURL = `http://127.0.0.1:${port}`;

export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  workers: 1,
  expect: {
    timeout: 8_000,
  },
  fullyParallel: true,
  reporter: process.env.CI ? [["html"], ["list"]] : "list",
  use: {
    baseURL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  webServer: {
    command: `bash -lc "ulimit -n 4096; pnpm build && pnpm start --hostname 127.0.0.1 --port ${port}"`,
    url: `${baseURL}/sign-in`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      ...process.env,
      FEEDMYOWL_DEMO_MODE: "1",
      NEXT_PUBLIC_FEEDMYOWL_DEMO_MODE: "1",
      VERCEL_ENV: "development",
      NEXT_PUBLIC_VERCEL_ENV: "development",
      PORT: String(port),
    },
  },
  projects: [
    {
      name: "desktop",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1280, height: 900 },
      },
    },
    {
      name: "mobile",
      use: {
        ...devices["Pixel 5"],
        viewport: { width: 390, height: 844 },
      },
    },
  ],
});
