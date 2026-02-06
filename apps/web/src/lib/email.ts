/**
 * Module Boundary: Email
 *
 * This file is the ONLY place in the codebase that imports from "resend".
 * All email sending goes through this file. If we ever switch from Resend
 * to another email provider (Postmark, SendGrid, etc.), only this file
 * needs to change. (Principle 4)
 *
 * Current implementation: Resend
 *
 * What this file provides:
 *   - sendWelcomeEmail(): Send a welcome email to new users
 *   - sendEmail(): Generic email sending function
 *
 * Note: At launch, we may not send many emails. This module exists
 * from day one so the boundary is established and ready when needed.
 */

import { Resend } from "resend";

/**
 * Resend SDK instance.
 * Uses the API key from environment variables.
 */
const resend = new Resend(process.env.RESEND_API_KEY);

/**
 * Send a welcome email to a newly registered user.
 *
 * @param to - The recipient's email address
 * @param name - The user's name (for personalization)
 */
export async function sendWelcomeEmail(to: string, name?: string) {
  await resend.emails.send({
    from: "FeedMyOwl <hello@feedmyowl.com>",
    to,
    subject: "Welcome to FeedMyOwl",
    text: `Hi${name ? ` ${name}` : ""},\n\nWelcome to FeedMyOwl! You can now add up to 10 RSS feeds for free.\n\nHappy reading,\nThe FeedMyOwl Team`,
  });
}

/**
 * Send a generic email. Use this for transactional emails that
 * don't have their own dedicated function yet.
 *
 * @param to - Recipient email address
 * @param subject - Email subject line
 * @param text - Plain text email body
 */
export async function sendEmail(to: string, subject: string, text: string) {
  await resend.emails.send({
    from: "FeedMyOwl <hello@feedmyowl.com>",
    to,
    subject,
    text,
  });
}
