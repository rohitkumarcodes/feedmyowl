import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/server/auth";
import { ensureUserRecord } from "@/lib/server/app-user";
import { db, eq, users } from "@/lib/server/database";
import { handleApiRouteError } from "@/lib/server/api-errors";
import { assertTrustedWriteOrigin } from "@/lib/server/csrf";
import { parseRequestJson } from "@/lib/server/http/request-json";
import { isOwlAscii } from "@/lib/shared/owl-brand";
import type { SettingsLogoPatchResponseBody } from "@/contracts/api/settings";

export async function PATCH(request: NextRequest) {
  try {
    const csrfFailure = assertTrustedWriteOrigin(request, "api.settings.logo.patch");
    if (csrfFailure) {
      return csrfFailure;
    }

    const { clerkId } = await requireAuth();
    const user = await ensureUserRecord(clerkId);

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const payload = await parseRequestJson(request);
    const owlAscii = payload?.owlAscii;

    if (typeof owlAscii !== "string" || !isOwlAscii(owlAscii)) {
      return NextResponse.json({ error: "Invalid owl selection." }, { status: 400 });
    }

    await db
      .update(users)
      .set({
        owlAscii,
        updatedAt: new Date(),
      })
      .where(eq(users.id, user.id));

    return NextResponse.json({ owlAscii } satisfies SettingsLogoPatchResponseBody);
  } catch (error) {
    return handleApiRouteError(error, "api.settings.logo.patch");
  }
}
