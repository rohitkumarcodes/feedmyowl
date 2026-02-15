import "server-only";

import { cache } from "react";
import { getCurrentUser, requireAuth } from "@/lib/server/auth";
import { db, eq, users } from "@/lib/server/database";

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

type AppUser = Awaited<ReturnType<typeof ensureUserRecord>>;

/**
 * Request-scoped helper for authenticated server components/routes.
 * Resolves Clerk identity once and returns the corresponding app user row.
 */
export const getAuthenticatedAppUser = cache(
  async (): Promise<{
    clerkId: string;
    appUser: AppUser;
  }> => {
    const { clerkId } = await requireAuth();
    const appUser = await ensureUserRecord(clerkId);
    return { clerkId, appUser };
  },
);
