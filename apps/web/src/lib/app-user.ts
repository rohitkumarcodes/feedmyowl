import { getCurrentUser } from "@/lib/auth";
import { db, eq, users } from "@/lib/database";

/**
 * Ensures a matching row exists in our own users table for a signed-in Clerk user.
 * If webhook delivery is delayed, we create the row on demand.
 */
export async function ensureUserRecord(clerkId: string) {
  const existingUser = await db.query.users.findFirst({
    where: eq(users.clerkId, clerkId),
  });

  if (existingUser) {
    return existingUser;
  }

  const currentUser = await getCurrentUser();
  const fallbackEmail =
    currentUser && currentUser.clerkId === clerkId ? currentUser.email : null;

  if (!fallbackEmail) {
    return null;
  }

  try {
    const [createdUser] = await db
      .insert(users)
      .values({ clerkId, email: fallbackEmail })
      .returning();

    return createdUser;
  } catch {
    // If another request created the row first, read it again.
    return await db.query.users.findFirst({
      where: eq(users.clerkId, clerkId),
    });
  }
}
