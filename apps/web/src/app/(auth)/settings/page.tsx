import { requireAuth } from "@/lib/server/auth";
import { db, eq, users } from "@/lib/server/database";
import { ensureUserRecord } from "@/lib/server/app-user";
import { SettingsOverview } from "@/features/settings/components/SettingsOverview";
import { coerceReadingMode, DEFAULT_READING_MODE } from "@/lib/shared/reading-mode";

/**
 * This page reads per-user data at request time — never statically prerender.
 */
export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const { clerkId } = await requireAuth();
  const ensuredUser = await ensureUserRecord(clerkId);

  if (!ensuredUser) {
    return <SettingsOverview email="Unknown" readingMode={DEFAULT_READING_MODE} />;
  }

  const user = await db.query.users.findFirst({
    where: eq(users.id, ensuredUser.id),
    columns: {
      email: true,
      readingMode: true,
    },
  });

  const safeEmail = user?.email ?? ensuredUser.email;
  const safeReadingMode = user
    ? coerceReadingMode(user.readingMode)
    : DEFAULT_READING_MODE;

  return <SettingsOverview email={safeEmail} readingMode={safeReadingMode} />;
}
