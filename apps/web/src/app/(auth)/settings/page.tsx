import { requireAuth } from "@/lib/server/auth";
import { db, eq, users } from "@/lib/server/database";
import { ensureUserRecord } from "@/lib/server/app-user";
import { SettingsOverview } from "@/features/settings/components/SettingsOverview";
import { coerceOwlAscii, DEFAULT_OWL_ASCII } from "@/lib/shared/owl-brand";
import { coerceThemeMode, DEFAULT_THEME_MODE } from "@/lib/shared/theme-mode";

/**
 * This page reads per-user data at request time — never statically prerender.
 */
export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const { clerkId } = await requireAuth();
  const ensuredUser = await ensureUserRecord(clerkId);

  if (!ensuredUser) {
    return (
      <SettingsOverview
        email="Unknown"
        owlAscii={DEFAULT_OWL_ASCII}
        themeMode={DEFAULT_THEME_MODE}
      />
    );
  }

  const user = await db.query.users.findFirst({
    where: eq(users.id, ensuredUser.id),
    columns: {
      email: true,
      owlAscii: true,
      themeMode: true,
    },
  });

  const safeEmail = user?.email ?? ensuredUser.email;
  const safeOwlAscii = user ? coerceOwlAscii(user.owlAscii) : DEFAULT_OWL_ASCII;
  const safeThemeMode = user ? coerceThemeMode(user.themeMode) : DEFAULT_THEME_MODE;

  return (
    <SettingsOverview
      email={safeEmail}
      owlAscii={safeOwlAscii}
      themeMode={safeThemeMode}
    />
  );
}
