import { getCurrentUser } from "@/lib/auth";
import { db, eq, users } from "@/lib/database";

const userCompatColumns = {
  id: true,
  clerkId: true,
  email: true,
  subscriptionTier: true,
  stripeCustomerId: true,
  stripeSubscriptionId: true,
  createdAt: true,
  updatedAt: true,
} as const;

/**
 * Ensures a matching row exists in our own users table for a signed-in Clerk user.
 * If webhook delivery is delayed, we create the row on demand.
 */
export async function ensureUserRecord(clerkId: string) {
  const existingUser = await db.query.users.findFirst({
    where: eq(users.clerkId, clerkId),
    columns: userCompatColumns,
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
      .returning({
        id: users.id,
        clerkId: users.clerkId,
        email: users.email,
        subscriptionTier: users.subscriptionTier,
        stripeCustomerId: users.stripeCustomerId,
        stripeSubscriptionId: users.stripeSubscriptionId,
        createdAt: users.createdAt,
        updatedAt: users.updatedAt,
      });

    return createdUser;
  } catch {
    // If another request created the row first, read it again.
    return await db.query.users.findFirst({
      where: eq(users.clerkId, clerkId),
      columns: userCompatColumns,
    });
  }
}
