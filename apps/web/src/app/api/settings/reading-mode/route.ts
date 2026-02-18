import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/server/auth";
import { ensureUserRecord } from "@/lib/server/app-user";
import { db, eq, users } from "@/lib/server/database";
import { handleApiRouteError } from "@/lib/server/api-errors";
import { assertTrustedWriteOrigin } from "@/lib/server/csrf";
import { parseRequestJson } from "@/lib/server/http/request-json";
import { isReadingMode } from "@/lib/shared/reading-mode";
import type { SettingsReadingModePatchResponseBody } from "@/contracts/api/settings";

export async function PATCH(request: NextRequest) {
  try {
    const csrfFailure = assertTrustedWriteOrigin(
      request,
      "api.settings.reading-mode.patch",
    );
    if (csrfFailure) {
      return csrfFailure;
    }

    const { clerkId } = await requireAuth();
    const user = await ensureUserRecord(clerkId);

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const payload = await parseRequestJson(request);
    const readingMode = payload?.readingMode;

    if (typeof readingMode !== "string" || !isReadingMode(readingMode)) {
      return NextResponse.json(
        { error: "Invalid reading mode selection." },
        { status: 400 },
      );
    }

    await db
      .update(users)
      .set({
        readingMode,
        updatedAt: new Date(),
      })
      .where(eq(users.id, user.id));

    return NextResponse.json({
      readingMode,
    } satisfies SettingsReadingModePatchResponseBody);
  } catch (error) {
    return handleApiRouteError(error, "api.settings.reading-mode.patch");
  }
}
