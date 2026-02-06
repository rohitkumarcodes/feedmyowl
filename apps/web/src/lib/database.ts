/**
 * Module Boundary: Database
 *
 * This file is the ONLY place in the codebase that imports from "drizzle-orm",
 * "@neondatabase/serverless", or "@/db/schema". All database access goes through
 * this file. If we ever switch databases, ORMs, or hosting providers, only this
 * file (and db/schema.ts) needs to change. (Principle 4: Modularity)
 *
 * Current implementation: Drizzle ORM + Neon serverless driver
 *
 * What this file exports:
 *   - db: The Drizzle database instance (for queries)
 *   - eq, and, or, not, desc, asc: Query comparison operators
 *   - users, folders, feeds, feedItems: Schema table references
 *
 * Usage in other files:
 *   import { db, eq, users } from "@/lib/database";
 *   const user = await db.query.users.findFirst({ where: eq(users.clerkId, id) });
 */

import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import type { NeonHttpDatabase } from "drizzle-orm/neon-http";
import * as schema from "@/db/schema";

/**
 * Re-export Drizzle query operators through this module boundary.
 * API routes import these from "@/lib/database" — never from "drizzle-orm" directly.
 */
export { eq, and, or, not, desc, asc } from "drizzle-orm";

/**
 * Re-export schema table references through this module boundary.
 * API routes import these from "@/lib/database" — never from "@/db/schema" directly.
 */
export { users, folders, feeds, feedItems } from "@/db/schema";

/**
 * Lazy-initialized Drizzle database instance.
 *
 * Why lazy? Next.js collects page data for API routes at BUILD time, which
 * triggers module imports. If we call neon() at the top level, it crashes
 * because DATABASE_URL isn't available during the build. By using a getter,
 * the connection is only created when `db` is first accessed at RUNTIME
 * (i.e., when an actual request comes in and DATABASE_URL is set).
 *
 * Uses HTTP-based queries via Neon's serverless driver (no persistent
 * connection), which is ideal for serverless environments like Vercel.
 *
 * Examples:
 *   // Simple query
 *   const users = await db.select().from(schema.users);
 *
 *   // Relational query (uses the relations defined in schema.ts)
 *   const userWithFeeds = await db.query.users.findFirst({
 *     where: eq(schema.users.clerkId, clerkId),
 *     with: { feeds: true },
 *   });
 *
 *   // Insert
 *   await db.insert(schema.users).values({ clerkId, email });
 */
/** Full type of our Drizzle instance, including schema-aware .query property */
type Database = NeonHttpDatabase<typeof schema>;

let _db: Database | null = null;

export function getDb(): Database {
  if (!_db) {
    const sql = neon(process.env.DATABASE_URL!);
    _db = drizzle(sql, { schema });
  }
  return _db;
}

/**
 * Convenience alias — import { db } and use it just like before.
 * The Proxy defers the neon() call until db is first accessed at runtime,
 * so the build never tries to connect to the database.
 */
export const db: Database = new Proxy({} as Database, {
  get(_target, prop) {
    return getDb()[prop as keyof Database];
  },
});
