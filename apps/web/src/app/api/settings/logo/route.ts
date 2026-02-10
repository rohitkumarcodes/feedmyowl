import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { ensureUserRecord } from "@/lib/app-user";
import { db, eq, users } from "@/lib/database";
import { handleApiRouteError } from "@/lib/api-errors";
import { isMissingColumnError } from "@/lib/db-compat";
import { isOwlAscii } from "@/lib/owl-brand";

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
    if (isMissingColumnError(error, "owl_ascii")) {
      return NextResponse.json(
        {
          error:
            "Logo settings are temporarily unavailable. Apply latest database migrations.",
        },
        { status: 503 }
      );
    }

    return handleApiRouteError(error, "api.settings.logo.patch");
  }
}
