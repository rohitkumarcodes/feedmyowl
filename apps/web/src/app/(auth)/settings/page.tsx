import { requireAuth } from "@/lib/auth";
import { db, eq, users } from "@/lib/database";
import { ensureUserRecord } from "@/lib/app-user";
import { SettingsOverview } from "@/components/settings-overview";
import { coerceOwlAscii, DEFAULT_OWL_ASCII } from "@/lib/owl-brand";

/**
 * This page reads per-user data at request time — never statically prerender.
 */
export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const { clerkId } = await requireAuth();
  const ensuredUser = await ensureUserRecord(clerkId);

  if (!ensuredUser) {
    return <SettingsOverview email="Unknown" owlAscii={DEFAULT_OWL_ASCII} />;
  }

  const user = await db.query.users.findFirst({
    where: eq(users.id, ensuredUser.id),
  });

  const safeUser = user ?? ensuredUser;

  return (
    <SettingsOverview
      email={safeUser.email}
      owlAscii={coerceOwlAscii(safeUser.owlAscii)}
    />
  );
}
