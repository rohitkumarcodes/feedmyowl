#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const defaultRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const root = path.resolve(process.env.ARCHITECTURE_BOUNDARY_PROJECT_ROOT ?? defaultRoot);
const srcRoot = path.resolve(
  process.env.ARCHITECTURE_BOUNDARY_SOURCE_ROOT ?? path.join(root, "apps/web/src"),
);

const restrictedImports = [
  {
    label: "Database packages",
    matches: ["drizzle-orm", "drizzle-orm/", "@neondatabase/serverless", "@/db/schema"],
    allowedFiles: ["apps/web/src/db/schema.ts", "apps/web/src/lib/server/database.ts"],
  },
  {
    label: "RSS parser SDK",
    matches: ["rss-parser"],
    allowedFiles: ["apps/web/src/lib/server/feed-parser.ts"],
  },
];

function toRepoPath(filePath) {
  return path.relative(root, filePath).split(path.sep).join("/");
}

function listSourceFiles(directory) {
  const entries = fs.readdirSync(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...listSourceFiles(fullPath));
      continue;
    }

    if (!/\.(ts|tsx)$/.test(entry.name)) {
      continue;
    }

    if (
      entry.name.includes(".test.") ||
      fullPath.includes(`${path.sep}test${path.sep}`)
    ) {
      continue;
    }

    files.push(fullPath);
  }

  return files;
}

function findImports(source) {
  const imports = [];
  const patterns = [
    /\bimport\s+(?:type\s+)?(?:[^'"()]+?\s+from\s+)?["']([^"']+)["']/g,
    /\bexport\s+(?:type\s+)?[^'"()]+?\s+from\s+["']([^"']+)["']/g,
    /\bimport\s*\(\s*["']([^"']+)["']\s*\)/g,
  ];

  for (const pattern of patterns) {
    let match = pattern.exec(source);
    while (match) {
      imports.push(match[1]);
      match = pattern.exec(source);
    }
  }

  return imports;
}

function matchesRule(importPath, rule) {
  return rule.matches.some((restrictedPath) => {
    if (restrictedPath.endsWith("/")) {
      return importPath.startsWith(restrictedPath);
    }
    return importPath === restrictedPath;
  });
}

const violations = [];

if (!fs.existsSync(srcRoot)) {
  console.error(`Architecture boundary source root does not exist: ${srcRoot}`);
  process.exit(1);
}

for (const filePath of listSourceFiles(srcRoot)) {
  const repoPath = toRepoPath(filePath);
  const source = fs.readFileSync(filePath, "utf8");
  const imports = findImports(source);

  for (const importPath of imports) {
    for (const rule of restrictedImports) {
      if (!matchesRule(importPath, rule)) {
        continue;
      }

      if (!rule.allowedFiles.includes(repoPath)) {
        violations.push({ repoPath, importPath, rule });
      }
    }
  }
}

if (violations.length > 0) {
  console.error("Architecture boundary check failed.\n");
  for (const violation of violations) {
    console.error(
      `- ${violation.repoPath} imports "${violation.importPath}" directly (${violation.rule.label}).`,
    );
    console.error(
      `  Allowed boundary files: ${violation.rule.allowedFiles.join(", ")}\n`,
    );
  }
  process.exit(1);
}

console.log("Architecture boundary check passed.");
