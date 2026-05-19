import "server-only";
import { NextResponse } from "next/server";

export function handleApiRouteError(error: unknown, route: string) {
  console.error(`[api-error] route=${route}`, error);
  return NextResponse.json({ error: "Internal server error" }, { status: 500 });
}
