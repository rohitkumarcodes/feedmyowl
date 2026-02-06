import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { db, eq, users } from "@/lib/database";
import { ensureUserRecord } from "@/lib/app-user";

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export async function GET() {
  try {
    const { clerkId } = await requireAuth();
    const ensuredUser = await ensureUserRecord(clerkId);

    if (!ensuredUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const user = await db.query.users.findFirst({
      where: eq(users.id, ensuredUser.id),
      with: { feeds: true },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const outlines = user.feeds
      .map((feed) => {
        const title = escapeXml(feed.title || feed.url);
        const url = escapeXml(feed.url);
        return `    <outline text="${title}" title="${title}" type="rss" xmlUrl="${url}" htmlUrl="${url}" />`;
      })
      .join("\n");

    const nowIso = new Date().toISOString();
    const opml = `<?xml version="1.0" encoding="UTF-8"?>
<opml version="2.0">
  <head>
    <title>FeedMyOwl Export</title>
    <dateCreated>${nowIso}</dateCreated>
  </head>
  <body>
${outlines}
  </body>
</opml>
`;

    const filenameDate = nowIso.slice(0, 10);

    return new NextResponse(opml, {
      status: 200,
      headers: {
        "Content-Type": "text/x-opml; charset=utf-8",
        "Content-Disposition": `attachment; filename="feedmyowl-feeds-${filenameDate}.opml"`,
        "Cache-Control": "no-store",
      },
    });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
