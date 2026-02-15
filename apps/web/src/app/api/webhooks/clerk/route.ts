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
 * Security: Every request is verified using the Clerk webhook secret
 * via svix signature verification. Unverified requests are rejected.
 * (Principle 11: Security by Delegation)
 */

import { NextRequest, NextResponse } from "next/server";
import { verifyClerkWebhook } from "@/lib/server/auth";
import { db, eq, users } from "@/lib/server/database";
import { captureError } from "@/lib/server/error-tracking";

export async function POST(request: NextRequest) {
  try {
    // --- Step 1: Verify the webhook signature ---
    // Read the raw body and svix headers needed for verification.
    // If the signature is invalid, verifyClerkWebhook() will throw.
    const body = await request.text();
    const svixId = request.headers.get("svix-id");
    const svixTimestamp = request.headers.get("svix-timestamp");
    const svixSignature = request.headers.get("svix-signature");

    if (!svixId || !svixTimestamp || !svixSignature) {
      return NextResponse.json({ error: "Missing svix headers" }, { status: 400 });
    }

    let payload: { type: string; data: Record<string, unknown> };
    try {
      payload = verifyClerkWebhook(body, {
        "svix-id": svixId,
        "svix-timestamp": svixTimestamp,
        "svix-signature": svixSignature,
      });
    } catch {
      return NextResponse.json({ error: "Invalid webhook signature" }, { status: 401 });
    }

    // --- Step 2: Handle the verified event ---
    const { type, data } = payload;

    switch (type) {
      case "user.created": {
        // A new user signed up — create a row in our database
        const emailAddresses = data.email_addresses as
          | Array<{ email_address: string }>
          | undefined;
        const email = emailAddresses?.[0]?.email_address;
        if (!email) {
          return NextResponse.json(
            { error: "No email in webhook payload" },
            { status: 400 },
          );
        }

        await db.insert(users).values({
          clerkId: data.id as string,
          email,
        });
        break;
      }

      case "user.updated": {
        // User updated their profile — sync email
        const updatedAddresses = data.email_addresses as
          | Array<{ email_address: string }>
          | undefined;
        const updatedEmail = updatedAddresses?.[0]?.email_address;
        if (updatedEmail) {
          await db
            .update(users)
            .set({ email: updatedEmail, updatedAt: new Date() })
            .where(eq(users.clerkId, data.id as string));
        }
        break;
      }

      case "user.deleted": {
        // User deleted their account — remove from our database
        // Cascade delete will also remove their feeds and feed items
        await db.delete(users).where(eq(users.clerkId, data.id as string));
        break;
      }

      default:
        // Ignore other event types
        break;
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    captureError(error, { webhook: "clerk" });
    return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 });
  }
}
