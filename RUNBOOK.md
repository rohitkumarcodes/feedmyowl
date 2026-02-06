# FeedMyOwl — Emergency Runbook

> Plain-language instructions for what to do when things break.
> This document must be accessible even if the app itself is down.
> Keep a copy somewhere outside the app (email, notes app, printed).
> (Principle 8: Documentation as a first-class activity)

---

## Quick Reference: Service Dashboards

| Service | Dashboard URL | What it manages |
|---|---|---|
| Vercel | https://vercel.com/dashboard | App + blog hosting, deployments, rollbacks |
| Neon | https://console.neon.tech/ | PostgreSQL database |
| Clerk | https://dashboard.clerk.com/ | User authentication |
| Stripe | https://dashboard.stripe.com/ | Payments and subscriptions |
| Resend | https://resend.com/dashboard | Email sending |
| Sentry | https://sentry.io/ | Error tracking and alerts |
| UptimeRobot | https://uptimerobot.com/dashboard | Uptime monitoring |
| Cloudflare | https://dash.cloudflare.com/ | DNS, SSL, DDoS protection |

---

## The App Is Down

### Step 1: Check what's down

1. Go to UptimeRobot dashboard — is it showing app.feedmyowl.com as down?
2. Go to Vercel dashboard — check if the latest deployment is healthy.
3. Go to Sentry — check for a spike in errors.

### Step 2: Try a rollback

If the app went down after a recent deployment:

1. Go to Vercel dashboard → project → Deployments.
2. Find the last working deployment (the one before the broken one).
3. Click the three dots menu → "Promote to Production".
4. Wait 30–60 seconds for the rollback to complete.
5. Verify the app is back up.

### Step 3: Check the database

If rollback didn't help, the database might be the issue:

1. Go to Neon dashboard → check if the database is online.
2. Try connecting via the Neon SQL editor.
3. If the database is down, check Neon's status page: https://neonstatus.com/

### Step 4: Check DNS

If neither Vercel nor Neon are down:

1. Go to Cloudflare dashboard → check DNS records for feedmyowl.com and app.feedmyowl.com.
2. Verify the records point to Vercel.
3. Check Cloudflare's status page: https://www.cloudflarestatus.com/

---

## Database Issues

### Slow queries

1. Go to Neon dashboard → check the "Queries" tab for slow queries.
2. Check Sentry for timeout errors.

### Need to restore from backup

1. Go to Neon dashboard → project → Branches.
2. Neon provides point-in-time recovery — you can restore to any point in the last 7 days (free tier) or 30 days (paid tier).
3. Create a new branch from the desired point in time.
4. Test the restored data.
5. When confirmed, update DATABASE_URL to point to the restored branch.

### Running migrations

```bash
# From the repo root:
pnpm db:generate   # Generate migration files from schema changes
pnpm db:migrate    # Apply pending migrations to the database
```

---

## Authentication Issues (Clerk)

### Users can't sign in

1. Go to Clerk dashboard → check if the service is operational.
2. Check Clerk's status page: https://status.clerk.com/
3. Verify environment variables are set correctly in Vercel.

### Webhook not syncing users

1. Go to Clerk dashboard → Webhooks → check delivery history.
2. Look for failed deliveries.
3. Check Sentry for errors in the `/api/webhooks/clerk` endpoint.
4. If needed, manually resend failed webhooks from the Clerk dashboard.

---

## Payment Issues (Stripe)

### Subscription not activating

1. Go to Stripe dashboard → search for the customer.
2. Check if the subscription status is "active".
3. Check Sentry for errors in the `/api/webhooks/stripe` endpoint.
4. Verify the webhook endpoint is configured in Stripe dashboard.

### Issuing a refund

1. Go to Stripe dashboard → Payments.
2. Find the payment to refund.
3. Click "Refund" and follow the prompts.

### Stripe webhook not working

1. Go to Stripe dashboard → Developers → Webhooks.
2. Check the webhook endpoint status and recent delivery attempts.
3. Verify the STRIPE_WEBHOOK_SECRET environment variable in Vercel.

---

## Email Issues (Resend)

### Emails not sending

1. Go to Resend dashboard → check delivery logs.
2. Verify the RESEND_API_KEY is set correctly in Vercel.
3. Check if you've hit the free tier limit (100 emails/day).

---

## Error Tracking (Sentry)

### Not receiving error alerts

1. Go to Sentry dashboard → project → Settings → Alerts.
2. Verify alert rules are configured.
3. Check that SENTRY_DSN is set correctly in Vercel.

---

## Deployment

### How to deploy

Deployments happen automatically when you push to the `main` branch on GitHub.

1. Push your code: `git push origin main`
2. Vercel automatically builds and deploys.
3. Check Vercel dashboard for deployment status.

### How to rollback

1. Go to Vercel dashboard → project → Deployments.
2. Find the previous working deployment.
3. Click the three dots menu → "Promote to Production".

---

## Environment Variables

All environment variables are managed in the Vercel dashboard:
1. Go to Vercel → Project → Settings → Environment Variables.
2. Make changes there (not in code).
3. Redeploy for changes to take effect.

A reference list of all required variables is in `apps/web/.env.example`.

---

## Contacts / Support

| Service | Support |
|---|---|
| Vercel | https://vercel.com/support |
| Neon | https://neon.tech/docs/introduction/support |
| Clerk | https://clerk.com/support |
| Stripe | https://support.stripe.com/ |
| Resend | https://resend.com/support |
| Sentry | https://help.sentry.io/ |
| Cloudflare | https://support.cloudflare.com/ |

---

*Keep this document up to date. Review it monthly (see Monthly Operations Checklist in PROJECT_CONTEXT.md).*
