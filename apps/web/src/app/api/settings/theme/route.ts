import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { ensureUserRecord } from "@/lib/app-user";
import { db, eq, users } from "@/lib/database";
import { handleApiRouteError } from "@/lib/api-errors";
import { assertTrustedWriteOrigin } from "@/lib/csrf";
import { isMissingColumnError } from "@/lib/db-compat";
import { isThemeMode } from "@/lib/theme-mode";

async function parseRequestJson(
  request: NextRequest
): Promise<Record<string, unknown> | null> {
  try {
    return (await request.json()) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const csrfFailure = assertTrustedWriteOrigin(request, "api.settings.theme.patch");
    if (csrfFailure) {
      return csrfFailure;
    }

    const { clerkId } = await requireAuth();
    const user = await ensureUserRecord(clerkId);

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const payload = await parseRequestJson(request);
    const themeMode = payload?.themeMode;

    if (typeof themeMode !== "string" || !isThemeMode(themeMode)) {
      return NextResponse.json({ error: "Invalid theme selection." }, { status: 400 });
    }

    await db
      .update(users)
      .set({
        themeMode,
        updatedAt: new Date(),
      })
      .where(eq(users.id, user.id));

    return NextResponse.json({ themeMode });
  } catch (error) {
    if (isMissingColumnError(error, "theme_mode")) {
      return NextResponse.json(
        {
          error:
            "Theme settings are temporarily unavailable. Apply latest database migrations.",
        },
        { status: 503 }
      );
    }

    return handleApiRouteError(error, "api.settings.theme.patch");
  }
}
