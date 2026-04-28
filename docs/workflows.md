# FeedMyOwl Development And Preview Workflows

This guide explains how to review FeedMyOwl safely before changes reach paying
customers.

## The Simple Release Path

Use the same three-step path for most product changes:

1. Review locally with fake data.
2. Review on Vercel Preview with test auth and test data.
3. Ship to Production only after the Preview looks right.

Do not skip straight from local review to Production.

## Step 1: Start The Work Locally

Use local review while the coding agent or developer is still changing code.
This is the fastest way to inspect protected UI like the feeds workspace or
settings screen without logging into Clerk.

Ask the coding agent:

```text
Use the local fixture preview workflow.

Run pnpm dev:web:preview, then review:
- http://localhost:3000/dev/feeds-preview
- http://localhost:3000/dev/settings-preview

Do not log into Clerk for this local UI check. These pages must use fake data
only. Check the changed screen, click the important controls, and tell me what
looks good or broken.
```

The agent will run this from the repo root:

```bash
pnpm dev:web:preview
```

Then you or the agent can open:

- `http://localhost:3000/dev/feeds-preview`
- `http://localhost:3000/dev/settings-preview`

These pages use fake fixture data only. They do not read Clerk users, Neon
database rows, or production customer data.

Important safety details:

- The `/dev/*` preview pages only work in local `next dev`.
- They require the explicit `FEEDMYOWL_DEV_PREVIEW=1` flag, which the
  `pnpm dev:web:preview` script sets for you.
- They are blocked on Vercel Preview and Vercel Production.
- The real `/feeds` and `/settings` pages still require Clerk sign-in.

Before moving on, ask the agent to run the basic checks:

```text
Run the basic checks before we move to Vercel Preview:
- pnpm lint:web
- pnpm typecheck
- pnpm test:web
- pnpm check:architecture

Tell me whether they all passed.
```

If you are happy with the local result, ask the agent to commit and push the
branch:

```text
I am happy with the local version. Commit these changes with a clear message,
then push the branch so Vercel can create a Preview URL.
```

The agent should not touch production secrets, production data, or generated
database migrations unless the task specifically requires a database change.

## Step 2: Review The Vercel Preview

Use Vercel Preview when you want to review a real live URL before Production.
This is the place to test real sign-in, real app routing, and non-production
data.

Ask the coding agent:

```text
Use the Vercel Preview workflow.

Find the Vercel Preview URL for this branch. Confirm it is using Preview
environment variables, not Production secrets. I will review it with a test
Clerk account.

Do not enable local fixture preview flags on Vercel.
```

The Preview URL should behave like the real app:

- Clerk auth is on.
- You sign in with a test Clerk account.
- Data comes from a non-production Neon database or database branch.
- Production customer accounts and production feed data are not used for experiments.

Review steps for you:

1. Open the Vercel Preview URL from the pull request or Vercel dashboard.
2. Sign in with a test Clerk account.
3. Review `/feeds`, `/settings`, and any page changed by the work.
4. Add or import test feeds only.
5. Tell the agent what is wrong, or say the Preview is approved.

If the Preview is not right, ask the agent to fix the code locally, push again,
and review the new Preview URL. Repeat until you are happy.

### Preview Environment Variables

In Vercel, set Preview environment variables separately from Production.

Recommended Preview values:

- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`: Clerk development or test publishable key.
- `CLERK_SECRET_KEY`: Clerk development or test secret key.
- `CLERK_WEBHOOK_SECRET`: Clerk webhook secret for the Preview webhook endpoint.
  - `DATABASE_URL`: Neon non-production database URL or Neon branch URL.
  - `RESEND_API_KEY`: a non-production-safe key or sending setup.
- `SENTRY_DSN`: a preview/staging Sentry project if available.
- `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`: preview-safe Redis
  values if rate limiting is being exercised.
- `CRON_SECRET`: a Preview-only secret, not the Production value.

Do not set `FEEDMYOWL_DEV_PREVIEW=1`, `FEEDMYOWL_DEMO_MODE=1`, or
`NEXT_PUBLIC_FEEDMYOWL_DEMO_MODE=1` in Vercel Preview.

## Step 3: Ship To Production

Only do this after you are happy with the Vercel Preview.

Ask the coding agent:

```text
The Vercel Preview is approved.

Prepare this for Production. Confirm the checks are passing, confirm no local
fixture preview flags are enabled on Vercel, and then merge or promote the
approved Preview according to the repo's normal production process.

After Production deploys, give me the Production URL and a short list of what to
verify.
```

The exact production action depends on how the repo is connected to Vercel:

- If Production deploys from the main branch, merge the approved branch into
  main.
- If Vercel uses promotion, promote the approved Preview deployment.
- If there is a pull request, merge it only after the Preview is approved.

After Production deploys, do a short final check:

1. Open the Production app.
2. Sign in with your normal founder/admin account.
3. Check the changed page or flow.
4. Do not create risky test data in Production.
5. If something looks wrong, stop and ask the agent to investigate before doing
   more changes.

## Production Safety

Production should stay boring and protected.

- Never copy the production `DATABASE_URL` into Preview.
- Never copy Clerk production secrets into Preview.
- Never use real customer accounts for experiments.
- Never enable local fixture preview flags on Vercel.
- Deploy to Production only after Preview has been reviewed and approved.

If something needs risky testing, test it in Preview first with test accounts
and test data.
