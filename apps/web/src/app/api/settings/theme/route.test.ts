import type { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireAuth: vi.fn(),
  ensureUserRecord: vi.fn(),
  dbUpdate: vi.fn(),
  dbUpdateSet: vi.fn(),
  dbUpdateSetWhere: vi.fn(),
  eq: vi.fn(),
  handleApiRouteError: vi.fn(),
  assertTrustedWriteOrigin: vi.fn(),
}));

vi.mock("@/lib/server/auth", () => ({
  requireAuth: mocks.requireAuth,
  isAuthRequiredError: vi.fn(() => false),
}));

vi.mock("@/lib/server/app-user", () => ({
  ensureUserRecord: mocks.ensureUserRecord,
}));

vi.mock("@/lib/server/database", () => ({
  db: {
    update: mocks.dbUpdate,
  },
  eq: mocks.eq,
  users: {
    id: "id",
  },
}));

vi.mock("@/lib/server/api-errors", () => ({
  handleApiRouteError: mocks.handleApiRouteError,
}));

vi.mock("@/lib/server/csrf", () => ({
  assertTrustedWriteOrigin: mocks.assertTrustedWriteOrigin,
}));

import { PATCH } from "@/app/api/settings/theme/route";

function createPatchRequest(body: unknown): NextRequest {
  return new Request("https://app.feedmyowl.test/api/settings/theme", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }) as NextRequest;
}

describe("PATCH /api/settings/theme", () => {
  beforeEach(() => {
    mocks.requireAuth.mockResolvedValue({ clerkId: "clerk_123" });
    mocks.ensureUserRecord.mockResolvedValue({ id: "user_123" });
    mocks.assertTrustedWriteOrigin.mockReturnValue(null);

    mocks.dbUpdateSetWhere.mockResolvedValue(undefined);
    mocks.dbUpdateSet.mockReturnValue({
      where: mocks.dbUpdateSetWhere,
    });
    mocks.dbUpdate.mockReturnValue({
      set: mocks.dbUpdateSet,
    });

    mocks.eq.mockReturnValue("where-clause");
    mocks.handleApiRouteError.mockImplementation(() =>
      Response.json({ error: "Internal server error" }, { status: 500 }),
    );
  });

  it("returns 200 and persists the selected theme for valid input", async () => {
    const response = await PATCH(createPatchRequest({ themeMode: "dark" }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.themeMode).toBe("dark");
    expect(mocks.dbUpdate).toHaveBeenCalled();
    expect(mocks.dbUpdateSet).toHaveBeenCalledWith({
      themeMode: "dark",
      updatedAt: expect.any(Date),
    });
    expect(mocks.dbUpdateSetWhere).toHaveBeenCalledWith("where-clause");
  });

  it("accepts system theme mode", async () => {
    const response = await PATCH(createPatchRequest({ themeMode: "system" }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.themeMode).toBe("system");
    expect(mocks.dbUpdateSet).toHaveBeenCalledWith({
      themeMode: "system",
      updatedAt: expect.any(Date),
    });
  });

  it("returns 400 for invalid theme selection", async () => {
    const response = await PATCH(createPatchRequest({ themeMode: "night" }));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe("Invalid theme selection.");
    expect(mocks.dbUpdate).not.toHaveBeenCalled();
  });

  it("returns 400 when request JSON is malformed", async () => {
    const malformedRequest = new Request(
      "https://app.feedmyowl.test/api/settings/theme",
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: "{not-json",
      },
    ) as NextRequest;

    const response = await PATCH(malformedRequest);
    expect(response.status).toBe(400);
  });

  it("returns 404 when the authenticated user record is missing", async () => {
    mocks.ensureUserRecord.mockResolvedValue(null);

    const response = await PATCH(createPatchRequest({ themeMode: "light" }));
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.error).toBe("User not found");
    expect(mocks.dbUpdate).not.toHaveBeenCalled();
  });

  it("delegates unexpected errors to shared API error handling", async () => {
    mocks.requireAuth.mockRejectedValue(new Error("Unauthorized: user is not signed in"));
    mocks.handleApiRouteError.mockReturnValue(
      Response.json({ error: "Unauthorized" }, { status: 401 }),
    );

    const response = await PATCH(createPatchRequest({ themeMode: "light" }));
    const body = await response.json();

    expect(mocks.handleApiRouteError).toHaveBeenCalledWith(
      expect.any(Error),
      "api.settings.theme.patch",
    );
    expect(response.status).toBe(401);
    expect(body.error).toBe("Unauthorized");
  });
});
