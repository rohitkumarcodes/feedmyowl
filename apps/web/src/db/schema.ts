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
 *   - feed_folder_memberships: Many-to-many feed-folder assignment links
 *   - feed_items: Individual articles/entries fetched from feeds
 *
 * Key design decisions:
 *   - UUID primary keys: No enumeration risk, safe for distributed systems
 *   - Cascade deletes: Deleting a user removes folders, feeds, and memberships;
 *     deleting a folder removes memberships; deleting a feed removes memberships
 *     and items
 *   - We store our own users table (not just rely on Clerk) so we own our data
 *     and keep service boundaries modular (Principle 4)
 *
 * Docs: https://orm.drizzle.team/docs/sql-schema-declaration
 */

import { relations, sql } from "drizzle-orm";
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

  /** Selected ASCII owl logo shown in app chrome and favicon */
  owlAscii: varchar("owl_ascii", { length: 20 }).default("{o,o}").notNull(),

  /** Selected app appearance mode (`light`, `dark`, or `system`) */
  themeMode: varchar("theme_mode", { length: 10 }).default("system").notNull(),

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
 * Folder deletion removes folder memberships while feeds remain intact.
 */
export const folders = pgTable(
  "folders",
  {
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
  },
  (table) => ({
    /**
     * Prevent duplicate folder names per user (case-insensitive).
     * The application checks for duplicates first (fast path); this index
     * is the safety net for concurrent requests (TOCTOU).
     */
    userNameUniqueIdx: uniqueIndex("folders_user_id_lower_name_unique").on(
      table.userId,
      sql`lower(${table.name})`,
    ),
  }),
);

// =============================================================================
// FEEDS TABLE
// =============================================================================
/**
 * Stores RSS/Atom feed subscriptions. Each feed belongs to one user and can
 * can be assigned to folders via feed_folder_memberships.
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

    /** The RSS/Atom feed URL */
    url: text("url").notNull(),

    /** Feed title (populated from the feed's <title> after first fetch) */
    title: varchar("title", { length: 500 }),

    /** Optional user-defined display name that overrides the source feed title */
    customTitle: varchar("custom_title", { length: 255 }),

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

    /** Latest ETag seen from the feed endpoint for conditional requests */
    httpEtag: text("http_etag"),

    /** Latest Last-Modified seen from the feed endpoint for conditional requests */
    httpLastModified: text("http_last_modified"),

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
    userUrlUniqueIdx: uniqueIndex("feeds_user_id_url_unique").on(table.userId, table.url),
  }),
);

// =============================================================================
// FEED-FOLDER MEMBERSHIP TABLE
// =============================================================================
/**
 * Stores many-to-many assignments between feeds and folders.
 */
export const feedFolderMemberships = pgTable(
  "feed_folder_memberships",
  {
    /** Unique identifier (UUID v4, auto-generated) */
    id: uuid("id").defaultRandom().primaryKey(),

    /** Which user owns this membership */
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),

    /** Which feed is assigned */
    feedId: uuid("feed_id")
      .references(() => feeds.id, { onDelete: "cascade" })
      .notNull(),

    /** Which folder receives the feed assignment */
    folderId: uuid("folder_id")
      .references(() => folders.id, { onDelete: "cascade" })
      .notNull(),

    /** When this membership was created */
    createdAt: timestamp("created_at").defaultNow().notNull(),

    /** When this membership was last updated */
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    /**
     * Prevent duplicate membership rows for the same user/feed/folder.
     */
    userFeedFolderUniqueIdx: uniqueIndex(
      "feed_folder_memberships_user_feed_folder_unique",
    ).on(table.userId, table.feedId, table.folderId),
  }),
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
export const feedItems = pgTable(
  "feed_items",
  {
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

    /** Deterministic fallback dedupe key for items without stable GUIDs */
    contentFingerprint: text("content_fingerprint"),

    /** When the article was published (from the feed, not when we fetched it) */
    publishedAt: timestamp("published_at"),

    /** When the user opened this article in FeedMyOwl */
    readAt: timestamp("read_at"),

    /** When we first stored this item */
    createdAt: timestamp("created_at").defaultNow().notNull(),

    /** When this row was last updated */
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    /**
     * Canonical dedupe for GUID-backed items.
     * Partial index avoids conflicting with rows where guid is null.
     */
    feedGuidUniqueIdx: uniqueIndex("feed_items_feed_id_guid_unique")
      .on(table.feedId, table.guid)
      .where(sql`${table.guid} is not null`),

    /**
     * Fallback dedupe when no GUID is available.
     */
    feedFingerprintUniqueIdx: uniqueIndex("feed_items_feed_id_content_fingerprint_unique")
      .on(table.feedId, table.contentFingerprint)
      .where(sql`${table.guid} is null and ${table.contentFingerprint} is not null`),
  }),
);

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
  feedFolderMemberships: many(feedFolderMemberships),
}));

export const foldersRelations = relations(folders, ({ one, many }) => ({
  user: one(users, { fields: [folders.userId], references: [users.id] }),
  feeds: many(feeds),
  memberships: many(feedFolderMemberships),
}));

export const feedsRelations = relations(feeds, ({ one, many }) => ({
  user: one(users, { fields: [feeds.userId], references: [users.id] }),
  items: many(feedItems),
  folderMemberships: many(feedFolderMemberships),
}));

export const feedFolderMembershipsRelations = relations(
  feedFolderMemberships,
  ({ one }) => ({
    user: one(users, {
      fields: [feedFolderMemberships.userId],
      references: [users.id],
    }),
    feed: one(feeds, {
      fields: [feedFolderMemberships.feedId],
      references: [feeds.id],
    }),
    folder: one(folders, {
      fields: [feedFolderMemberships.folderId],
      references: [folders.id],
    }),
  }),
);

export const feedItemsRelations = relations(feedItems, ({ one }) => ({
  feed: one(feeds, { fields: [feedItems.feedId], references: [feeds.id] }),
}));
