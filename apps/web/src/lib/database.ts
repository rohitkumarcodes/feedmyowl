/**
 * Module Boundary: Database
 *
 * This file is the ONLY place in the codebase that talks to the database.
 * All database queries go through this file. If we ever switch from Neon
 * to another PostgreSQL host (or even a different database entirely),
 * only this file needs to change. (Principle 4: Modularity)
 *
 * Current implementation: Drizzle ORM + Neon serverless driver
 *
 * Usage in other files:
 *   import { db } from "@/lib/database";
 *   const user = await db.query.users.findFirst({ where: ... });
 */

import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "@/db/schema";

/**
 * Create a Neon serverless SQL connection.
 * This uses HTTP-based queries (no persistent connection),
 * which is ideal for serverless environments like Vercel.
 */
const sql = neon(process.env.DATABASE_URL!);

/**
 * The Drizzle ORM database instance.
 * Use this for all database operations throughout the app.
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
export const db = drizzle(sql, { schema });
