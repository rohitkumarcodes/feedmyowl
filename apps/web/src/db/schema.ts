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
 *   - folders: Optional feed groups in the sidebar
 *   - feeds: RSS/Atom feeds that users have subscribed to
 *   - feed_items: Individual articles/entries fetched from feeds
 *
 * Key design decisions:
 *   - UUID primary keys: No enumeration risk, safe for distributed systems
 *   - Cascade deletes: Deleting a user removes folders and feeds; deleting a
 *     folder removes feeds; deleting a feed removes items
 *   - We store our own users table (not just rely on Clerk) so we own our data
 *     and keep service boundaries modular (Principle 4)
 *
 * Docs: https://orm.drizzle.team/docs/sql-schema-declaration
 */

import { relations } from "drizzle-orm";
import {
  pgTable,
  text,
  timestamp,
  uniqueIndex,
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
// FOLDERS TABLE
// =============================================================================
/**
 * Stores user-created feed folders shown in the sidebar.
 *
 * Folder deletion cascades to its feeds by design for this MVP phase.
 */
export const folders = pgTable("folders", {
  /** Unique identifier (UUID v4, auto-generated) */
  id: uuid("id").defaultRandom().primaryKey(),

  /** Which user owns this folder */
  userId: uuid("user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),

  /** Human-readable folder name shown in the sidebar */
  name: varchar("name", { length: 255 }).notNull(),

  /** When this folder was created */
  createdAt: timestamp("created_at").defaultNow().notNull(),

  /** When this folder was last updated */
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// =============================================================================
// FEEDS TABLE
// =============================================================================
/**
 * Stores RSS/Atom feed subscriptions. Each feed belongs to one user and can
 * optionally belong to a folder.
 *
 * The title and description are populated after the first successful fetch.
 */
export const feeds = pgTable(
  "feeds",
  {
    /** Unique identifier (UUID v4, auto-generated) */
    id: uuid("id").defaultRandom().primaryKey(),

    /** Which user owns this feed — cascade delete removes feeds when user is deleted */
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),

    /**
     * Optional folder grouping in the sidebar.
     * On folder delete we preserve feeds by moving them to Uncategorized (NULL).
     */
    folderId: uuid("folder_id").references(() => folders.id, {
      onDelete: "set null",
    }),

    /** The RSS/Atom feed URL */
    url: text("url").notNull(),

    /** Feed title (populated from the feed's <title> after first fetch) */
    title: varchar("title", { length: 500 }),

    /** Feed description (populated from the feed's <description> after first fetch) */
    description: text("description"),

    /** When this feed was last fetched/refreshed by the user */
    lastFetchedAt: timestamp("last_fetched_at"),

    /** Last fetch status used for calm inline status messaging in the UI */
    lastFetchStatus: varchar("last_fetch_status", { length: 50 }),

    /** Short machine-like fetch error code (timeout, http_404, invalid_xml, etc.) */
    lastFetchErrorCode: varchar("last_fetch_error_code", { length: 80 }),

    /** Human-readable fetch error details shown as muted inline guidance */
    lastFetchErrorMessage: text("last_fetch_error_message"),

    /** When the last fetch error was recorded */
    lastFetchErrorAt: timestamp("last_fetch_error_at"),

    /** When this subscription was created */
    createdAt: timestamp("created_at").defaultNow().notNull(),

    /** When this row was last updated */
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    /**
     * A user should not be able to subscribe to the exact same URL twice.
     * Duplicate URLs are skipped during imports and manual add-feed.
     */
    userUrlUniqueIdx: uniqueIndex("feeds_user_id_url_unique").on(
      table.userId,
      table.url
    ),
  })
);

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

  /** When the user opened this article in FeedMyOwl */
  readAt: timestamp("read_at"),

  /** Cached full-article HTML extracted from the original page when available */
  extractedHtml: text("extracted_html"),

  /** When full-article extraction was last attempted */
  extractedAt: timestamp("extracted_at"),

  /** Extraction result status (success, fallback, failed) */
  extractionStatus: varchar("extraction_status", { length: 50 }),

  /** Source used for rendered content (postlight, feed_summary, etc.) */
  extractionSource: varchar("extraction_source", { length: 80 }),

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
  folders: many(folders),
  feeds: many(feeds),
}));

export const foldersRelations = relations(folders, ({ one, many }) => ({
  user: one(users, { fields: [folders.userId], references: [users.id] }),
  feeds: many(feeds),
}));

export const feedsRelations = relations(feeds, ({ one, many }) => ({
  user: one(users, { fields: [feeds.userId], references: [users.id] }),
  folder: one(folders, { fields: [feeds.folderId], references: [folders.id] }),
  items: many(feedItems),
}));

export const feedItemsRelations = relations(feedItems, ({ one }) => ({
  feed: one(feeds, { fields: [feedItems.feedId], references: [feeds.id] }),
}));
