# FeedMyOwl

Reading-first RSS/Atom reader.

## Local Development

See `/Users/rohitkumar/master-directory/code/feedmyowl/RUNBOOK.md` for the full runbook.

Quick start:

```bash
pnpm install
pnpm dev:web
pnpm dev:web:preview
pnpm dev:blog
```

Useful checks:

```bash
pnpm ui:check:web
pnpm check:architecture
pnpm smoke:web
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

UI routine:

- Follow the UI checklist in `/Users/rohitkumar/master-directory/code/feedmyowl/RUNBOOK.md` section `2.1 UI change check routine` for every UI task.
- See `/Users/rohitkumar/master-directory/code/feedmyowl/docs/workflows.md` for local fixture preview and Vercel Preview review workflows.

Agent workflow:

- Start with `/Users/rohitkumar/master-directory/code/feedmyowl/AGENT_TASK_GUIDE.md` for copy-paste task prompts.
- Use `pnpm dev:web:preview` and open `/dev/feeds-preview` or `/dev/settings-preview` for local protected UI checks without real Clerk/DB data.
