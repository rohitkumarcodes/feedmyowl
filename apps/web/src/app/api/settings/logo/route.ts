import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { ensureUserRecord } from "@/lib/app-user";
import { db, eq, users } from "@/lib/database";
import { handleApiRouteError } from "@/lib/api-errors";
import { assertTrustedWriteOrigin } from "@/lib/csrf";
import { parseRequestJson } from "@/lib/http/request-json";
import { isOwlAscii } from "@/lib/owl-brand";

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

    return NextResponse.json({ owlAscii });
  } catch (error) {
    return handleApiRouteError(error, "api.settings.logo.patch");
  }
}
