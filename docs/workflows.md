# FeedMyOwl Development And Preview Workflows

This guide explains how to review FeedMyOwl safely before changes reach paying
customers.

## The Simple Release Path

Use the same three-step path for most product changes:

1. Review locally.
2. Review on Vercel Preview with test data.
3. Ship to Production only after the Preview looks right.

Do not skip straight from local review to Production.

## Step 1: Start The Work Locally

Use local review while the coding agent or developer is still changing code.

Ask the coding agent:

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
This is the place to test real app routing and non-production data.

Ask the coding agent:

```text
Use the Vercel Preview workflow.

Find the Vercel Preview URL for this branch. Confirm it is using Preview
environment variables, not Production secrets. I will review it.

Do not enable local fixture preview flags on Vercel.
```

The Preview URL should behave like the real app:

- Data comes from a non-production Neon database or database branch.
- Production customer accounts and production feed data are not used for experiments.

Review steps for you:

1. Open the Vercel Preview URL from the pull request or Vercel dashboard.
2. Review `/feeds`, `/settings`, and any page changed by the work.
3. Add or import test feeds only.
4. Tell the agent what is wrong, or say the Preview is approved.

If the Preview is not right, ask the agent to fix the code locally, push again,
and review the new Preview URL. Repeat until you are happy.

### Preview Environment Variables

In Vercel, set Preview environment variables separately from Production.

Recommended Preview values:

- `DATABASE_URL`: Neon non-production database URL or Neon branch URL.

Do not set `FEEDMYOWL_DEV_PREVIEW=1` or `FEEDMYOWL_DEMO_MODE` in Vercel Preview.

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
2. Check the changed page or flow.
3. Do not create risky test data in Production.
4. If something looks wrong, stop and ask the agent to investigate before doing
   more changes.

## Production Safety

Production should stay boring and protected.

- Never copy the production `DATABASE_URL` into Preview.
- Never use real customer accounts for experiments.
- Never enable local fixture preview flags on Vercel.
- Deploy to Production only after Preview has been reviewed and approved.

If something needs risky testing, test it in Preview first with test accounts
and test data.
