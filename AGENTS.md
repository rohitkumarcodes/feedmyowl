# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

All commands run from the repo root unless noted.

```bash
# Development
pnpm dev:web          # Next.js on :3000
pnpm dev:blog         # Eleventy with live reload

# Build
pnpm build:web
pnpm build:blog

# Quality
pnpm lint:web         # ESLint on apps/web/src
pnpm check:architecture # Enforce service/module import boundaries
pnpm agent:check      # Architecture + web lint/typecheck/test + format check
pnpm typecheck        # tsc --noEmit across all workspaces
pnpm test:web         # Vitest (run once)
pnpm test:web --watch # Vitest watch mode (via apps/web directly)
pnpm format           # Prettier write
pnpm format:check     # Prettier check

# Run a single test file
cd apps/web && pnpm vitest run src/path/to/file.test.ts

# Database (runs against Neon via DATABASE_URL in apps/web/.env.local)
pnpm db:generate      # Generate SQL migration from schema changes
pnpm db:migrate       # Apply pending migrations
pnpm db:studio        # Open Drizzle Studio
```

## Architecture

### Monorepo layout

```
apps/web/    — Next.js 15 App Router (app.feedmyowl.com)
apps/blog/   — Eleventy 3 static site (feedmyowl.com)
```

pnpm workspaces, no Turborepo. Node ≥ 22.

### `apps/web` source map

| Path                     | Purpose                                                 |
| ------------------------ | ------------------------------------------------------- |
| `src/app/`               | Next.js App Router pages and API routes                 |
| `src/app/(auth)/`        | Route group for pages (`/feeds`, `/settings`)           |
| `src/app/api/`           | All REST API handlers                                   |
| `src/features/feeds/`    | Feeds workspace: components, hooks, state               |
| `src/features/settings/` | Settings page components                                |
| `src/lib/server/`        | Server-only modules (DB, email, …)                      |
| `src/lib/client/`        | Browser-only modules (API client)                       |
| `src/lib/shared/`        | Isomorphic utilities (pagination, search, shortcuts)    |
| `src/contracts/api/`     | Shared TypeScript types for API request/response bodies |
| `src/db/schema.ts`       | Drizzle ORM table definitions (single source of truth)  |
| `src/db/migrations/`     | Generated SQL migration files — never edit by hand      |

### Module boundary pattern

Every external service is accessed exclusively through one file in `src/lib/server/`. Import from these, never from the underlying package directly:

| Boundary file       | Wraps                                                     |
| ------------------- | --------------------------------------------------------- |
| `database.ts`       | Drizzle ORM + Neon (`db`, schema tables, query operators) |
| `feed-parser.ts`    | rss-parser                                                |
| `error-tracking.ts` | Console-based error logging                               |

`pnpm check:architecture` enforces these boundaries.

### API route pattern

Large routes (e.g. `/api/feeds`) split handler logic into co-located files:

- `route.ts` — thin router (exports `GET`, `POST`, `PATCH`)
- `route.get.ts`, `route.post.ts`, `route.patch.ts` — actual handler logic
- `route.shared.ts` — helpers shared across handlers
- `route.*.test.ts` — Vitest unit tests

### State management

The feeds workspace (`FeedsWorkspace.tsx`) holds all client state in `useState` and passes it down. There is no global state library. Pure logic lives in `src/features/feeds/state/` (tested independently), UI mutations happen in `src/features/feeds/hooks/`.

### CSS

Plain CSS Modules (`*.module.css`) per component. No Tailwind. Global base styles in `src/styles/globals.css`.

## Database

Schema: `src/db/schema.ts` — tables: `folders`, `feeds`, `feed_folder_memberships`, `feed_items`.

Key design choices:

- UUID PKs everywhere; cascade delete feed → items
- Folder assignment is membership-only (`feed_folder_memberships`); `feeds` has no `folder_id`
- Article retention: max 50 items per feed, ordered by `COALESCE(published_at, created_at) DESC`
- Dedupe: partial unique index on `(feed_id, guid)` where guid not null; fallback on `(feed_id, content_fingerprint)` where guid is null

After any schema change: `pnpm db:generate` then `pnpm db:migrate`.

## Security conventions

- Feed fetch hardening: SSRF blocking, redirect revalidation, timeout + retries (`src/lib/server/feed-fetcher.ts`)
- Article content rendered through DOMPurify (`src/lib/shared/article-sanitize-config.ts`)

## Environment variables

Copy `apps/web/.env.example` to `apps/web/.env.local`. Required: `DATABASE_URL`.

`drizzle.config.ts` auto-loads `DATABASE_URL` from `.env.local` so `db:*` commands work without extra setup.

## Blog (`apps/blog`)

Eleventy 3 with Nunjucks templates. Source in `apps/blog/src/`, output to `apps/blog/_site/` (gitignored). Front matter `---` must be the very first line in `.njk` files — any preceding content (including comments) breaks permalink parsing.

## Coding conventions

- Every file targeting a non-trivial concern gets a module-level doc comment explaining its role in the system — the founder is not a programmer and must be able to understand all code.
- Tests live alongside source files (`*.test.ts` / `*.test.tsx`).
- The `@/` alias resolves to `apps/web/src/`.
- `server-only` is imported at the top of all server boundary files to prevent accidental client bundling.
