/**
 * Database Schema — Drizzle ORM Table Definitions
 *
 * This file defines all database tables for FeedMyOwl.
 * Drizzle ORM uses these definitions to:
 *   1. Generate SQL migrations (via drizzle-kit)
 *   2. Provide type-safe query building in application code
 *
 * Tables:
 *   - users: One row per registered user (synced from Clerk via webhook)
 *   - feeds: RSS/Atom feeds that users have subscribed to
 *   - feed_items: Individual articles/entries fetched from feeds
 *
 * Key design decisions:
 *   - UUID primary keys: No enumeration risk, safe for distributed systems
 *   - Cascade deletes: Deleting a user removes their feeds; deleting a feed removes its items
 *   - We store our own users table (not just rely on Clerk) so we own our data (Principle 4)
 *
 * Docs: https://orm.drizzle.team/docs/sql-schema-declaration
 */

import { relations } from "drizzle-orm";
import {
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

// =============================================================================
// USERS TABLE
// =============================================================================
/**
 * Stores user account data. A row is created here when Clerk sends a
 * "user.created" webhook (see /api/webhooks/clerk/route.ts).
 *
 * We store our own copy of user data so that:
 *   1. We can link feeds and items to users with foreign keys
 *   2. We own our data even if we switch auth providers (Principle 4)
 *   3. We can store app-specific fields (subscription tier, Stripe IDs)
 */
export const users = pgTable("users", {
  /** Unique identifier (UUID v4, auto-generated) */
  id: uuid("id").defaultRandom().primaryKey(),

  /** Clerk's user ID — used to look up our user from Clerk's auth context */
  clerkId: varchar("clerk_id", { length: 255 }).unique().notNull(),

  /** User's email address (synced from Clerk) */
  email: varchar("email", { length: 255 }).notNull(),

  /** Subscription tier: "free" (default) or "paid" */
  subscriptionTier: varchar("subscription_tier", { length: 50 })
    .default("free")
    .notNull(),

  /** Stripe customer ID — set when user first interacts with Stripe */
  stripeCustomerId: varchar("stripe_customer_id", { length: 255 }),

  /** Stripe subscription ID — set when user subscribes to paid tier */
  stripeSubscriptionId: varchar("stripe_subscription_id", { length: 255 }),

  /** When this row was created */
  createdAt: timestamp("created_at").defaultNow().notNull(),

  /** When this row was last updated */
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// =============================================================================
// FEEDS TABLE
// =============================================================================
/**
 * Stores RSS/Atom feed subscriptions. Each feed belongs to one user.
 * Free users can have up to 10 feeds; paid users can have more.
 *
 * The title and description are populated after the first successful fetch.
 */
export const feeds = pgTable("feeds", {
  /** Unique identifier (UUID v4, auto-generated) */
  id: uuid("id").defaultRandom().primaryKey(),

  /** Which user owns this feed — cascade delete removes feeds when user is deleted */
  userId: uuid("user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),

  /** The RSS/Atom feed URL */
  url: text("url").notNull(),

  /** Feed title (populated from the feed's <title> after first fetch) */
  title: varchar("title", { length: 500 }),

  /** Feed description (populated from the feed's <description> after first fetch) */
  description: text("description"),

  /** When this feed was last fetched/refreshed by the user */
  lastFetchedAt: timestamp("last_fetched_at"),

  /** When this subscription was created */
  createdAt: timestamp("created_at").defaultNow().notNull(),

  /** When this row was last updated */
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// =============================================================================
// FEED ITEMS TABLE
// =============================================================================
/**
 * Stores individual articles/entries from RSS/Atom feeds.
 * Items are created/updated when the user refreshes their feeds.
 *
 * Items are kept in the database even if the source feed goes down,
 * so users can always read previously fetched content.
 */
export const feedItems = pgTable("feed_items", {
  /** Unique identifier (UUID v4, auto-generated) */
  id: uuid("id").defaultRandom().primaryKey(),

  /** Which feed this item belongs to — cascade delete removes items when feed is deleted */
  feedId: uuid("feed_id")
    .references(() => feeds.id, { onDelete: "cascade" })
    .notNull(),

  /** The item's globally unique identifier (from the feed's <guid> or <id>) */
  guid: text("guid"),

  /** Article title */
  title: text("title"),

  /** Link to the original article */
  link: text("link"),

  /** Article content (HTML or plain text from the feed) */
  content: text("content"),

  /** Author name */
  author: varchar("author", { length: 255 }),

  /** When the article was published (from the feed, not when we fetched it) */
  publishedAt: timestamp("published_at"),

  /** When we first stored this item */
  createdAt: timestamp("created_at").defaultNow().notNull(),

  /** When this row was last updated */
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// =============================================================================
// RELATIONS (for Drizzle's relational query API)
// =============================================================================
/**
 * These relation definitions enable Drizzle's relational query API,
 * which lets us do things like:
 *   db.query.users.findFirst({ with: { feeds: true } })
 *
 * They don't affect the database schema — the actual foreign keys
 * are defined in the table definitions above.
 */

export const usersRelations = relations(users, ({ many }) => ({
  feeds: many(feeds),
}));

export const feedsRelations = relations(feeds, ({ one, many }) => ({
  user: one(users, { fields: [feeds.userId], references: [users.id] }),
  items: many(feedItems),
}));

export const feedItemsRelations = relations(feedItems, ({ one }) => ({
  feed: one(feeds, { fields: [feedItems.feedId], references: [feeds.id] }),
}));
