/**
 * Drizzle Kit Configuration
 *
 * This file configures drizzle-kit, the CLI tool for Drizzle ORM.
 * It's used to generate SQL migrations from our schema and push them to the database.
 *
 * Commands (run from repo root):
 *   pnpm db:generate  — Generate SQL migration files from schema changes
 *   pnpm db:migrate   — Apply pending migrations to the database
 *   pnpm db:studio    — Open Drizzle Studio (visual DB browser)
 *
 * Docs: https://orm.drizzle.team/docs/drizzle-config-file
 */

import { defineConfig } from "drizzle-kit";

export default defineConfig({
  // Path to our Drizzle schema file (table definitions)
  schema: "./src/db/schema.ts",

  // Where to output generated SQL migration files
  out: "./src/db/migrations",

  // Database driver — "neon-serverless" for Neon's serverless driver
  dialect: "postgresql",

  // Connection string from environment variable
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
