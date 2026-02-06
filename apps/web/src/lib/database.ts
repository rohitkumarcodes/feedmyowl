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
 *   - users, feeds, feedItems: Schema table references
 *
 * Usage in other files:
 *   import { db, eq, users } from "@/lib/database";
 *   const user = await db.query.users.findFirst({ where: eq(users.clerkId, id) });
 */

import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
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
export { users, feeds, feedItems } from "@/db/schema";

/**
 * The Drizzle ORM database instance.
 * Use this for all database operations throughout the app.
 *
 * Why lazy initialization?
 * Next.js imports modules at build time to collect page data.
 * During the build, runtime env vars like DATABASE_URL aren't available yet.
 * By creating the connection lazily (on first use), we avoid crashing the build.
 * The connection is cached after the first call, so subsequent queries reuse it.
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
let _db: ReturnType<typeof drizzle<typeof schema>> | null = null;

function getDb() {
  if (!_db) {
    const sql = neon(process.env.DATABASE_URL!);
    _db = drizzle(sql, { schema });
  }
  return _db;
}

/**
 * Proxy that forwards all property access to the lazily-initialized Drizzle instance.
 * Code throughout the app uses `db` exactly like before — no API change.
 */
export const db = new Proxy({} as ReturnType<typeof drizzle<typeof schema>>, {
  get(_target, prop, receiver) {
    const instance = getDb();
    const value = Reflect.get(instance, prop, receiver);
    return typeof value === "function" ? value.bind(instance) : value;
  },
});
