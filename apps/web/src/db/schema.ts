/**
 * Database Schema — Drizzle ORM Table Definitions
 *
 * This file defines all database tables for FeedMyOwl.
 * Drizzle ORM uses these definitions to:
 *   1. Generate SQL migrations (via drizzle-kit)
 *   2. Provide type-safe query building in application code
 *
 * Tables:
 *   - folders: Optional feed groups in the sidebar
 *   - feeds: RSS/Atom feeds that users have subscribed to
 *   - feed_folder_memberships: Many-to-many feed-folder assignment links
 *   - feed_items: Individual articles/entries fetched from feeds
 *
 * Key design decisions:
 *   - UUID primary keys: No enumeration risk, safe for distributed systems
 *   - Cascade deletes: Deleting a folder removes memberships; deleting a
 *     feed removes memberships and items
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

    /** Human-readable folder name shown in the sidebar */
    name: varchar("name", { length: 255 }).notNull(),

    /** When this folder was created */
    createdAt: timestamp("created_at").defaultNow().notNull(),

    /** When this folder was last updated */
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    /**
     * Prevent duplicate folder names (case-insensitive).
     * The application checks for duplicates first (fast path); this index
     * is the safety net for concurrent requests (TOCTOU).
     */
    nameUniqueIdx: uniqueIndex("folders_lower_name_unique").on(sql`lower(${table.name})`),
  }),
);

// =============================================================================
// FEEDS TABLE
// =============================================================================
/**
 * Stores RSS/Atom feed subscriptions.
 *
 * The title and description are populated after the first successful fetch.
 */
export const feeds = pgTable(
  "feeds",
  {
    /** Unique identifier (UUID v4, auto-generated) */
    id: uuid("id").defaultRandom().primaryKey(),

    /** The RSS/Atom feed URL */
    url: text("url").notNull(),

    /** Feed title (populated from the feed's <title> after first fetch) */
    title: varchar("title", { length: 500 }),

    /** Optional user-defined display name that overrides the source feed title */
    customTitle: varchar("custom_title", { length: 255 }),

    /** Feed description (populated from the feed's <description> after first fetch) */
    description: text("description"),

    /** When this feed was last fetched/refreshed */
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
     * A feed URL can only be subscribed to once.
     */
    urlUniqueIdx: uniqueIndex("feeds_url_unique").on(table.url),
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
     * Prevent duplicate membership rows for the same feed and folder.
     */
    feedFolderUniqueIdx: uniqueIndex("feed_folder_memberships_feed_folder_unique").on(
      table.feedId,
      table.folderId,
    ),
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

    /** When the user saved/bookmarked this article for later */
    savedAt: timestamp("saved_at"),

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
 *   db.query.feeds.findFirst({ with: { items: true } })
 *
 * They don't affect the database schema — the actual foreign keys
 * are defined in the table definitions above.
 */

export const foldersRelations = relations(folders, ({ many }) => ({
  feeds: many(feeds),
  memberships: many(feedFolderMemberships),
}));

export const feedsRelations = relations(feeds, ({ many }) => ({
  items: many(feedItems),
  folderMemberships: many(feedFolderMemberships),
}));

export const feedFolderMembershipsRelations = relations(
  feedFolderMemberships,
  ({ one }) => ({
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
