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

vi.mock("@/lib/auth", () => ({
  requireAuth: mocks.requireAuth,
}));

vi.mock("@/lib/app-user", () => ({
  ensureUserRecord: mocks.ensureUserRecord,
}));

vi.mock("@/lib/database", () => ({
  db: {
    update: mocks.dbUpdate,
  },
  eq: mocks.eq,
  users: {
    id: "id",
  },
}));

vi.mock("@/lib/api-errors", () => ({
  handleApiRouteError: mocks.handleApiRouteError,
}));

vi.mock("@/lib/csrf", () => ({
  assertTrustedWriteOrigin: mocks.assertTrustedWriteOrigin,
}));

import { PATCH } from "@/app/api/settings/logo/route";

function createPatchRequest(body: unknown): NextRequest {
  return new Request("https://app.feedmyowl.test/api/settings/logo", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }) as NextRequest;
}

describe("PATCH /api/settings/logo", () => {
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
      Response.json({ error: "Internal server error" }, { status: 500 })
    );
  });

  it("returns 200 and persists the selected owl for valid input", async () => {
    const response = await PATCH(createPatchRequest({ owlAscii: "{o,q}" }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.owlAscii).toBe("{o,q}");
    expect(mocks.dbUpdate).toHaveBeenCalled();
    expect(mocks.dbUpdateSet).toHaveBeenCalledWith({
      owlAscii: "{o,q}",
      updatedAt: expect.any(Date),
    });
    expect(mocks.dbUpdateSetWhere).toHaveBeenCalledWith("where-clause");
  });

  it("returns 400 for invalid owl selection", async () => {
    const response = await PATCH(createPatchRequest({ owlAscii: "invalid-owl" }));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe("Invalid owl selection.");
    expect(mocks.dbUpdate).not.toHaveBeenCalled();
  });

  it("returns 400 when request JSON is malformed", async () => {
    const malformedRequest = new Request(
      "https://app.feedmyowl.test/api/settings/logo",
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: "{not-json",
      }
    ) as NextRequest;

    const response = await PATCH(malformedRequest);
    expect(response.status).toBe(400);
  });

  it("returns 404 when the authenticated user record is missing", async () => {
    mocks.ensureUserRecord.mockResolvedValue(null);

    const response = await PATCH(createPatchRequest({ owlAscii: "{o,o}" }));
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.error).toBe("User not found");
    expect(mocks.dbUpdate).not.toHaveBeenCalled();
  });

  it("delegates unexpected errors to shared API error handling", async () => {
    mocks.requireAuth.mockRejectedValue(new Error("Unauthorized: user is not signed in"));
    mocks.handleApiRouteError.mockReturnValue(
      Response.json({ error: "Unauthorized" }, { status: 401 })
    );

    const response = await PATCH(createPatchRequest({ owlAscii: "{o,o}" }));
    const body = await response.json();

    expect(mocks.handleApiRouteError).toHaveBeenCalledWith(
      expect.any(Error),
      "api.settings.logo.patch"
    );
    expect(response.status).toBe(401);
    expect(body.error).toBe("Unauthorized");
  });
});
