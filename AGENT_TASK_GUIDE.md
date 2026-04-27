# FeedMyOwl Agent Task Guide

This guide gives non-programmers copy-paste prompts for coding agents. Use it with
`AGENTS.md`, which is the source of truth for architecture and commands.

## Before Every Task

Ask the agent to start with:

```text
Read AGENTS.md, RUNBOOK.md, and the files you plan to touch before editing.
Keep changes small, do not rewrite unrelated code, and do not edit generated DB
migrations by hand. Tell me the files you changed, checks you ran, screenshots
you captured for UI work, and anything you did not test.
```

## Bug Fix Prompt

```text
Fix this bug: <describe what you saw>.

Expected behavior: <what should happen>.
Actual behavior: <what happened>.
Please inspect the relevant code first, make the smallest safe fix, add or update
a focused test, and run the narrowest useful check plus any required repo checks.
```

## UI Change Prompt

```text
Change this UI: <page/flow and desired behavior>.

Follow RUNBOOK.md section "2.1 UI change check routine". Check desktop around
1280px wide and mobile around 390px wide. Capture screenshots, verify key
interactions, and report remaining risks.
```

## API Change Prompt

```text
Change this API behavior: <route and desired request/response>.

Follow the existing route split pattern. Update shared contract types in
apps/web/src/contracts/api when the response shape changes. Keep server-only
service access behind src/lib/server boundary files. Add route tests for success
and failure cases.
```

## Database Change Prompt

```text
Change the database model: <desired product behavior>.

Update apps/web/src/db/schema.ts only, then run pnpm db:generate. Do not edit
generated migration SQL by hand. Update server code and tests that depend on the
schema. Tell me exactly which migration was generated.
```

## Code Review Prompt

```text
Review the current changes as a senior engineer. Prioritize bugs, regressions,
security issues, missing tests, and architecture-boundary violations. Give file
and line references. If no issues are found, say that clearly and list residual
test gaps.
```

## Deploy Check Prompt

```text
Prepare this branch for deploy. Run pnpm format:check, pnpm lint, pnpm typecheck,
pnpm test, pnpm build, and the architecture boundary check. For UI changes, also
run the smoke tests or explain why they could not run. Summarize failures before
fixing them.
```

## Good Agent Handoff

Every agent handoff should include:

- Files changed.
- Product behavior changed.
- Checks run and results.
- Screenshots for UI work.
- What was not tested.
- Remaining risks or follow-up suggestions.
