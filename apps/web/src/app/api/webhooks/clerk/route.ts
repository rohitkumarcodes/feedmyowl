/**
 * Webhook: Clerk
 *
 * POST /api/webhooks/clerk
 *
 * Clerk sends webhooks when user events occur (sign up, update, delete).
 * This webhook handler syncs Clerk user data to our own database.
 *
 * Why we do this:
 *   - We own our user data, not just Clerk (Principle 4: Modularity)
 *   - We can link users to feeds via foreign keys in our database
 *   - If we ever switch auth providers, our user data is still intact
 *
 * Events handled:
 *   - user.created: Create a row in our users table
 *   - user.updated: Update the email in our users table
 *   - user.deleted: Delete the user (cascades to feeds and items)
 *
 * Security: In production, you should verify the webhook signature
 * using the Clerk webhook secret (CLERK_WEBHOOK_SECRET).
 * See: https://clerk.com/docs/integrations/webhooks
 *
 * TODO: Add webhook signature verification with svix
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/database";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { captureError } from "@/lib/error-tracking";

export async function POST(request: NextRequest) {
  try {
    const payload = await request.json();
    const { type, data } = payload;

    switch (type) {
      case "user.created": {
        // A new user signed up — create a row in our database
        const email = data.email_addresses?.[0]?.email_address;
        if (!email) {
          return NextResponse.json(
            { error: "No email in webhook payload" },
            { status: 400 }
          );
        }

        await db.insert(users).values({
          clerkId: data.id,
          email,
        });
        break;
      }

      case "user.updated": {
        // User updated their profile — sync email
        const updatedEmail = data.email_addresses?.[0]?.email_address;
        if (updatedEmail) {
          await db
            .update(users)
            .set({ email: updatedEmail, updatedAt: new Date() })
            .where(eq(users.clerkId, data.id));
        }
        break;
      }

      case "user.deleted": {
        // User deleted their account — remove from our database
        // Cascade delete will also remove their feeds and feed items
        await db.delete(users).where(eq(users.clerkId, data.id));
        break;
      }

      default:
        // Ignore other event types
        break;
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    captureError(error, { webhook: "clerk" });
    return NextResponse.json(
      { error: "Webhook processing failed" },
      { status: 500 }
    );
  }
}
