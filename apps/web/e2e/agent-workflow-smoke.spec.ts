import { expect, test } from "@playwright/test";

test("sign-in page stays reachable", async ({ page }) => {
  await page.goto("/sign-in");

  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
  await expect(page.getByLabel("Email")).toBeVisible();
  await expect(page.getByLabel("Password")).toBeVisible();
});

test("onboarding exposes import before the workspace", async ({ page }) => {
  await page.goto("/onboarding");

  await expect(page.getByRole("heading", { name: "Set up your feeds" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Import feeds" })).toBeVisible();
  await expect(page.getByRole("button", { name: /Click to upload/ })).toBeVisible();
  await expect(page.getByRole("link", { name: "Open feeds" })).toBeVisible();
});

test("feeds workspace opens the add feed dialog", async ({ page }) => {
  await page.goto("/feeds");

  await expect(page.getByRole("button", { name: "Add feed or folder" })).toBeVisible();
  await page.getByRole("button", { name: "Add feed or folder" }).click();
  await page.getByRole("button", { name: "Add feed", exact: true }).click();

  await expect(page.getByRole("dialog", { name: "Add feed" })).toBeVisible();
  await expect(page.getByLabel("Feed or site URL")).toBeVisible();
});

test("folder delete dialog keeps the selected action explicit", async ({ page }) => {
  await page.goto("/feeds");

  await page.getByLabel("Open folder actions for Product").click();
  await page.getByRole("button", { name: "Delete folder" }).click();

  await expect(page.getByRole("dialog", { name: "Delete folder" })).toBeVisible();
  await page.getByRole("button", { name: "Continue" }).click();

  const keepFeeds = page.getByRole("button", {
    name: /Delete folder, keep feeds/,
  });
  await keepFeeds.click();

  await expect(keepFeeds).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("button", { name: "Back" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Delete", exact: true })).toBeEnabled();
});

test("settings exposes import, export, backup, and restore surfaces", async ({
  page,
}) => {
  await page.goto("/settings");

  await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Import feeds" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Export feeds" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Backup and restore" })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "JSON Full backup including folders" }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Download JSON backup" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Restore from backup" })).toBeVisible();
});

test("mobile can move from feeds to article reader and back", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "mobile", "Mobile-only navigation smoke test.");

  await page.goto("/feeds");
  await page.getByRole("button", { name: "All feeds" }).click();
  const firstArticle = page.getByRole("button", {
    name: /Import preview now catches/,
  });
  await expect(firstArticle).toBeVisible();

  await firstArticle.dispatchEvent("click");
  await expect(
    page.getByRole("heading", { name: /Import preview now catches/ }),
  ).toBeVisible();

  await page.getByRole("button", { name: /Articles/ }).dispatchEvent("click");
  await expect(page.getByLabel("Search all articles")).toBeVisible();

  await page.getByRole("button", { name: /Feeds/ }).dispatchEvent("click");
  await expect(page.getByRole("button", { name: /^All feeds/ })).toBeVisible();
});
