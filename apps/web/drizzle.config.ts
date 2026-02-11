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
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

function parseEnvValue(rawValue: string): string {
  const trimmedValue = rawValue.trim();
  const isDoubleQuoted =
    trimmedValue.startsWith("\"") && trimmedValue.endsWith("\"");
  const isSingleQuoted =
    trimmedValue.startsWith("'") && trimmedValue.endsWith("'");

  if (isDoubleQuoted || isSingleQuoted) {
    return trimmedValue.slice(1, -1);
  }

  return trimmedValue;
}

/**
 * drizzle-kit does not auto-load Next.js env files.
 * Load DATABASE_URL from .env.local/.env so db:* commands work consistently.
 */
function ensureDatabaseUrlFromEnvFiles() {
  if (process.env.DATABASE_URL) {
    return;
  }

  const envFileNames = [".env.local", ".env"];

  for (const envFileName of envFileNames) {
    const envFilePath = path.join(process.cwd(), envFileName);
    if (!existsSync(envFilePath)) {
      continue;
    }

    const fileContents = readFileSync(envFilePath, "utf8");
    const lines = fileContents.split(/\r?\n/u);

    for (const line of lines) {
      const trimmedLine = line.trim();
      if (!trimmedLine || trimmedLine.startsWith("#")) {
        continue;
      }

      const normalizedLine = trimmedLine.startsWith("export ")
        ? trimmedLine.slice(7).trim()
        : trimmedLine;

      if (!normalizedLine.startsWith("DATABASE_URL=")) {
        continue;
      }

      const parsedValue = parseEnvValue(
        normalizedLine.slice("DATABASE_URL=".length)
      );

      if (parsedValue) {
        process.env.DATABASE_URL = parsedValue;
        return;
      }
    }
  }
}

ensureDatabaseUrlFromEnvFiles();

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
