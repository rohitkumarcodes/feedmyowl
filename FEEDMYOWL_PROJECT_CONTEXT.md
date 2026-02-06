# FeedMyOwl — Project Context Document

> **Purpose of this document:** This document is the single source of truth for the FeedMyOwl project. It contains the mission, product definition, architecture constraints, and decision-making principles. It is written to be readable by both humans and LLMs. When working with any AI assistant on any part of this project, paste this document into the conversation first so the AI has full context. Update this document as decisions are made.

> **Last updated:** 2026-02-06

---

## 1. Mission Statement

FeedMyOwl is a minimalist RSS/Atom feed reader web application. Its core mission is to **preserve the attention of the reader** by providing a calm, focused, and distraction-free reading experience.

The product exists because most modern feed readers have become noisy, feature-bloated, and designed around engagement metrics rather than reading quality. FeedMyOwl takes the opposite approach: fewer features, better reading.

The guiding question for every product decision is: **"Does this help the user read better, or does it distract them?"**

---

## 2. Product Definition

### What FeedMyOwl Is

- A web application where users can subscribe to RSS and Atom feeds and read them in a clean, focused interface.
- A tool that fetches feeds **only when the user explicitly requests it** (on login or by pressing a refresh button). There is no background polling, no push notifications, no unread counts badgering the user to come back.
- A freemium product: free for up to 10 feeds, paid subscription for more.

### What FeedMyOwl Is Not

- It is not a social platform. There are no comments, shares, likes, or social features.
- It is not a news aggregator or recommendation engine. It shows only what the user has explicitly subscribed to.
- It is not a "read later" service, bookmarking tool, or content archive (unless this changes in a future deliberate decision documented below).
- It is not a platform that competes on feature count. Simplicity is the feature.

### Domain and Hosting Structure

- **feedmyowl.com** — The public-facing website: landing page and blog. Static site, likely built with a static site generator (SSG).
- **app.feedmyowl.com** — The web application itself. Separate deployment from the website.
- These are two independent deployments sharing a domain, connected via DNS configuration.

### Business Model

- **Free tier:** Up to 10 RSS/Atom feed subscriptions. Full reading experience. No feature gating on the reading UI itself.
- **Paid tier:** More than 10 feeds. Pricing to be determined, but must cover infrastructure costs for both free and paid users with margin. See Principle 12.
- Payment processing via Stripe (or equivalent modular payment provider).

### Core User Flow

1. User signs up / logs in.
2. User adds RSS/Atom feed URLs (up to 10 free, more if paid).
3. User presses "Refresh" to fetch latest items from all subscribed feeds.
4. User reads articles in a clean, distraction-free interface.
5. User can import/export feeds via OPML.
6. User can export their data and delete their account at any time.

### Key Feature Decisions

| Feature | Decision | Rationale |
|---|---|---|
| Background feed fetching | **No** | Preserves attention. User controls when new content appears. |
| Unread counts / badges | **No** | Creates anxiety and compulsive checking. Antithetical to mission. |
| Push notifications | **No** | Distraction. Defeats the purpose. |
| OPML import/export | **Yes** | Industry standard. Builds trust. Lets users arrive and leave freely. |
| Feed item storage in database | **Yes** | Previously fetched articles remain available even if a feed is temporarily down. Better reliability. |
| Social features | **No** | Out of scope. Reading is a solitary, focused activity. |
| Search within feeds | **To be decided** | Document decision here when made. |
| Tagging / folders / organization | **To be decided** | Document decision here when made. |
| Dark mode | **To be decided** | Document decision here when made. |

---

## 3. Founder Context

The founder is **not a professional programmer**. All development, maintenance, and operations are done with the assistance of AI tools (LLMs). This is not a limitation to work around — it is a core architectural constraint that shapes every decision.

This means:

- The tech stack must be one that AI models are excellent at working with (widely used, extensively documented, heavily represented in training data).
- Every piece of code must be heavily commented and documented, because the founder may not remember what it does weeks later.
- Infrastructure must be as managed and automated as possible, because there is no ops team.
- The founder is the **product owner and architect** (makes all decisions), and AI is the **implementation partner** (writes code, debugs, explains).

---

## 4. Decision-Making Principles

These are the fifteen principles that govern every technical and business decision on this project. When evaluating any choice, test it against this list.

### Principle 1: One Stack, Full Commitment

Pick one language, one framework, one database, one hosting platform. Do not mix technologies unless absolutely forced to. Every additional technology is another thing that can break and another thing that needs to be understood and maintained. When considering adding a new tool or library, the first question is: "Can I do this with what I already have?"

### Principle 2: Managed Over Self-Managed, Always

If someone else will keep it running, updated, patched, and backed up, pay them to do it. The founder is a product owner, not a systems administrator. This applies to the database, hosting, authentication, email sending, payment processing, and DNS. The only things managed directly are application code and content.

### Principle 3: Battle-Tested Over Novel

Never be the first adopter of a library, service, or approach. Prefer solutions that have been around for years, have large communities, active maintenance, and extensive documentation and Stack Overflow answers. Newer alternatives may look better on paper, but they lack the ecosystem of help that a non-programmer founder needs. Battle-tested solutions are also better supported by AI assistants because they appear extensively in training data.

### Principle 4: Modularity — Every Piece Must Be Replaceable

The application must be built so that swapping out any single component (auth provider, database, payment processor, hosting platform, email service, feed parser) does not require rewriting the whole application. In practice, this means putting a clear boundary or abstraction layer around every external service. If any third-party service disappears tomorrow, only its specific module should need to change.

### Principle 5: Retractability — Every Change Must Be Reversible

No deployment should be a one-way door. Every change goes through Git. Every deployment can be rolled back to the previous version with a single action. No database migration should destroy data that existed before (deprecate columns, never delete them). Code is never edited directly on the server. Rollbacks are tested regularly before they are needed in an emergency.

### Principle 6: Minimal Surface Area

Every feature added is a feature that must be maintained, debugged, secured, documented, and explained — forever. Launch with the absolute minimum. Add features only when multiple real users ask for the same thing. The question is never "Would this be nice to have?" — it is "Is this worth maintaining forever?"

### Principle 7: The Reading Experience Is Sacred

This is the product's reason to exist. Every decision must be tested against: "Does this make the reading experience better, or does it distract from it?" If a feature, design choice, or technical decision does not serve calm, focused reading, it needs an exceptionally strong justification to exist.

### Principle 8: Documentation as a First-Class Activity

Documentation is not something done after building. It is part of building. Three types of documentation must be maintained from day one:

- **Decision Log** (`DECISION_LOG.md`): Why every tool, service, and approach was chosen, and what alternatives were considered.
- **Code Documentation**: Comments explaining what each file and function does, written for someone who does not know the codebase.
- **Emergency Runbook** (`RUNBOOK.md`): Plain-language instructions for what to do when things break, accessible even if the app itself is down. Includes how to restart services, roll back deployments, restore backups, issue refunds, and contact support for every managed service used.

### Principle 9: Observability — If You Cannot See It, You Cannot Fix It

The founder must know when the app is down, when errors are happening, and when something unusual is occurring — before users report it. This means uptime monitoring, error tracking, and basic logging from day one. These are not optional additions for later. They are launch requirements.

### Principle 10: Backups Are Non-Negotiable

The database must be backed up automatically, regularly, and to a location separate from the main server. Restoring from a backup must be tested at least once before launch and periodically thereafter. A backup that has never been tested is not a backup.

### Principle 11: Security by Delegation

The founder is not a security expert, so security-sensitive systems must not be built from scratch. Authentication, password hashing, session management, payment processing, and encryption are all handled by established third-party services. The founder's job is to connect them correctly, not to implement them. When in doubt about whether something has security implications, assume it does and delegate it.

### Principle 12: Know Your Costs Before Your Pricing

Every monthly cost (hosting, database, auth, email, monitoring, domain, payment processing fees) must be mapped out before setting a price. This calculation must be revisited every time a new service is added or user count changes significantly. The paid tier must cover the cost of both paying and free users combined, with margin.

### Principle 13: Assume You Will Be Unavailable

Everything must be designed so that the app can run untouched for two to four weeks without the founder. No manual processes that must happen daily or weekly. No scheduled tasks running on a personal computer. Everything is automated and hosted, so that if the founder is sick, on vacation, or busy, paying users are unaffected.

### Principle 14: Users Must Be Able to Leave

OPML import and export are supported. Users can export their data. Users can delete their accounts. This is both a legal requirement in many jurisdictions and a trust-building feature. Making it easy to leave makes people more likely to stay.

### Principle 15: AI Is the Junior Developer, the Founder Is the Architect

AI writes code, debugs errors, and explains concepts. The founder makes all decisions. AI must always be asked to explain its reasoning. If the founder does not understand why something is being done a certain way, the recommendation is not accepted until it is understood. A decision the founder does not understand is a decision the founder cannot maintain.

---

## 5. Tech Stack Decisions

> **Instructions:** Fill in this section as decisions are made. For each choice, record what was chosen, what alternatives were considered, and why this choice was made. Reference the relevant Principles.

| Component | Choice | Alternatives Considered | Rationale | Date Decided |
|---|---|---|---|---|
| Language | TypeScript | Plain JavaScript, Python | Type safety catches errors early; best AI support; one language for everything | 2026-02-06 |
| Framework (app) | Next.js | SvelteKit, Django | Handles frontend + backend in one codebase (Principle 1); largest ecosystem and AI training representation (Principle 3); best Vercel integration | 2026-02-06 |
| Database | PostgreSQL on Neon | Supabase Postgres, PlanetScale, SQLite | Postgres is the most battle-tested relational DB (Principle 3); Neon is pure managed Postgres with free tier — no bundling with auth or other services (Principle 4: modularity); can migrate to any other Postgres host if needed | 2026-02-06 |
| Hosting (app) | Vercel | Railway, Fly.io, Render | Made by Next.js creators; one-click rollbacks (Principle 5); automatic GitHub deploys; generous free tier; best non-programmer deployment experience | 2026-02-06 |
| Hosting (blog/landing) | Vercel | Cloudflare Pages, Netlify | Same platform as the app, fewer accounts to manage; free tier covers static sites easily | 2026-02-06 |
| Authentication | Clerk | Auth.js (NextAuth), Supabase Auth | Pre-built UI components, zero security code to write (Principle 11); free up to 10k MAU; excellent Next.js integration | 2026-02-06 |
| Payment processor | Stripe | Paddle, LemonSqueezy | Industry standard, best documentation, best AI support (Principle 3); handles subscriptions, failed payments, tax | 2026-02-06 |
| Email service | Resend | Postmark, SendGrid | Simple API, generous free tier (100/day), excellent Next.js/TypeScript support, minimal surface area (Principle 6) | 2026-02-06 |
| Feed parsing library | rss-parser | feedparser, fast-xml-parser | Most popular Node.js RSS/Atom parser; handles RSS 1.0, 2.0, Atom, and common malformations (Principle 3) | 2026-02-06 |
| Uptime monitoring | UptimeRobot | BetterStack, Pingdom | Free tier with 50 monitors at 5-min intervals; set and forget (Principle 9) | 2026-02-06 |
| Error tracking | Sentry | LogRocket, Bugsnag | Industry standard; official Next.js integration; generous free tier (Principle 9) | 2026-02-06 |
| DNS | Cloudflare | Namecheap DNS, Route53 | Free; industry standard; includes free SSL, CDN, DDoS protection; excellent dashboard | 2026-02-06 |
| Static site generator (blog) | Eleventy (11ty) | Astro, Hugo | Battle-tested since 2018 (Principle 3); zero client-side JS by default; no framework dependency; extremely simple mental model; founder's explicit preference | 2026-02-06 |

---

## 6. Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                        CLOUDFLARE DNS                       │
│                                                             │
│   feedmyowl.com ──────► Vercel (Eleventy static site)      │
│                           - Landing page                    │
│                           - Blog                            │
│                                                             │
│   app.feedmyowl.com ──► Vercel (Next.js app)               │
│                           - Frontend (React/TypeScript)      │
│                           - API routes (serverless)          │
└─────────────────────────────────────────────────────────────┘

┌─── Next.js App (app.feedmyowl.com) ────────────────────────┐
│                                                              │
│   ┌──────────┐  ┌───────────┐  ┌──────────┐  ┌───────────┐ │
│   │  Clerk   │  │  Stripe   │  │  Resend  │  │  Sentry   │ │
│   │  (Auth)  │  │ (Payments)│  │ (Email)  │  │ (Errors)  │ │
│   └────┬─────┘  └─────┬─────┘  └────┬─────┘  └─────┬─────┘ │
│        │              │              │              │        │
│   ┌────┴──────────────┴──────────────┴──────────────┴─────┐ │
│   │              Next.js API Routes                       │ │
│   │   /api/feeds    /api/refresh    /api/subscribe        │ │
│   │                                                       │ │
│   │   ┌─────────────┐    ┌──────────────────┐            │ │
│   │   │ rss-parser  │    │   PostgreSQL     │            │ │
│   │   │ (feed fetch │◄──►│   on Neon        │            │ │
│   │   │  & parse)   │    │   (users, feeds, │            │ │
│   │   └─────────────┘    │    articles)     │            │ │
│   │                      └──────────────────┘            │ │
│   └───────────────────────────────────────────────────────┘ │
│                                                              │
│   ┌───────────────────────────────────────────────────────┐ │
│   │              Next.js Frontend (React)                 │ │
│   │   - Reading interface                                 │ │
│   │   - Feed management                                   │ │
│   │   - Settings / account                                │ │
│   └───────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────┘

External monitoring:
   UptimeRobot ──► pings app.feedmyowl.com every 5 min
```

**Module Boundaries (Principle 4):**
Each external service is accessed through a single dedicated file in the codebase. If any service needs to be replaced, only that one file changes:
- `lib/auth.ts` — all Clerk interactions
- `lib/payments.ts` — all Stripe interactions
- `lib/email.ts` — all Resend interactions
- `lib/database.ts` — all Neon/Postgres interactions
- `lib/feed-parser.ts` — all rss-parser interactions
- `lib/error-tracking.ts` — all Sentry interactions

**Cost at Launch:**
| Service | Monthly Cost |
|---|---|
| Vercel (app + blog) | $0 (free tier) |
| Neon (database) | $0 (free tier) |
| Clerk (auth) | $0 (free up to 10k MAU) |
| Stripe | 2.9% + $0.30 per transaction |
| Resend (email) | $0 (free up to 100/day) |
| Sentry (errors) | $0 (free tier) |
| UptimeRobot | $0 (free tier) |
| Cloudflare (DNS) | $0 (free) |
| Domain (feedmyowl.com) | ~$10/year |
| **Total at launch** | **~$1/month + Stripe fees on transactions** |

---

## 7. Decision Log

> **Instructions:** Every significant decision gets an entry here. Use the format below. This is one of the most important sections of this document — it is your memory.

### Decision Template

```
### [DATE] — [SHORT TITLE]

**Decision:** What was decided.

**Context:** Why this decision needed to be made.

**Alternatives considered:**
- Alternative A — why it was rejected
- Alternative B — why it was rejected

**Principles referenced:** Which of the 15 principles supported this decision.

**Risks / tradeoffs:** What could go wrong or what was sacrificed.
```

### 2026-02-06 — Domain Name: feedmyowl.com

**Decision:** Registered `feedmyowl.com` as the project domain (original preference `feedtheowl.com` was unavailable).

**Context:** Needed to register the domain before anything else to secure the name.

**Alternatives considered:**
- feedtheowl.com — unavailable

**Principles referenced:** N/A (business decision).

**Risks / tradeoffs:** None significant. "Feed My Owl" works well as a brand name.

### 2026-02-06 — Complete Tech Stack Selection

**Decision:** The full tech stack was chosen: Next.js + TypeScript on Vercel (app), Eleventy on Vercel (blog/landing page), PostgreSQL on Neon (database), Clerk (auth), Stripe (payments), Resend (email), rss-parser (feed parsing), Sentry (error tracking), UptimeRobot (uptime monitoring), Cloudflare (DNS).

**Context:** This is the foundational decision for the entire project. It needed to be made before any code was written, and it needed to prioritize AI-assistability (founder is not a programmer), managed services, battle-tested tools, and modularity.

**Alternatives considered:**
- SvelteKit — smaller ecosystem, less AI training data, fewer Stack Overflow answers. Rejected per Principle 3.
- Django (Python) — would require separate frontend framework, violating Principle 1 (one stack).
- Supabase (bundled DB + auth) — bundles database and authentication into one provider, creating coupling that violates Principle 4 (modularity). If Supabase has issues, both DB and auth fail together.
- Railway (hosting) — no time limits on serverless functions, but costs from day one and less seamless rollback than Vercel. Feed fetching timeout constraint on Vercel is solvable by parallel fetching.
- Astro (blog) — good but newer than Eleventy; founder explicitly preferred Eleventy; 11ty has been battle-tested since 2018 and has zero framework dependencies.
- Auth.js/NextAuth — open source but requires more hands-on security work. Too risky for a non-programmer to configure correctly. Rejected per Principle 11.

**Principles referenced:** 1 (one stack), 2 (managed services), 3 (battle-tested), 4 (modularity), 5 (retractability via Vercel rollbacks), 11 (security by delegation), 15 (AI-assistable stack).

**Risks / tradeoffs:**
- Vercel serverless function timeout (10s free, 60s paid) constrains feed fetching. Mitigated by fetching feeds in parallel.
- Clerk is a third-party dependency for a critical function (auth). Mitigated by ensuring user data lives in our own database, not only in Clerk.
- Heavy reliance on free tiers. If multiple services change pricing simultaneously, costs could jump. Mitigated by Principle 12 (monitor costs regularly) and Principle 4 (any service can be replaced).

---

## 8. Legal and Compliance Checklist

> **Instructions:** Track progress on legal requirements here.

- [ ] Privacy Policy drafted and published
- [ ] Terms of Service drafted and published
- [ ] Cookie consent mechanism (if required for target markets)
- [ ] GDPR compliance (if serving EU users): data export, data deletion, consent
- [ ] Account deletion flow implemented
- [ ] Data export flow implemented
- [ ] Stripe compliance requirements met
- [ ] Legal review of Privacy Policy and Terms of Service by a qualified person

---

## 9. Pre-Launch Checklist

> **Instructions:** All of these must be completed before the first real user signs up.

- [ ] Core reading experience is working and feels good
- [ ] Authentication is working (sign up, log in, log out, password reset)
- [ ] Feed adding, refreshing, and reading flow is working
- [ ] OPML import and export is working
- [ ] Payment flow is working (subscribe, cancel, handle failures)
- [ ] Free tier limit (10 feeds) is enforced
- [ ] Uptime monitoring is configured and alerting
- [ ] Error tracking is configured and alerting
- [ ] Database backups are automated and tested (restore tested at least once)
- [ ] Emergency Runbook is written and accessible outside the app
- [ ] Git-based deployment pipeline is working (push to main = deploy)
- [ ] Rollback has been tested (deploy, break something, roll back, confirm fix)
- [ ] Privacy Policy and Terms of Service are published
- [ ] Landing page is live at feedmyowl.com
- [ ] DNS is configured for both feedmyowl.com and app.feedmyowl.com
- [ ] Monthly cost calculation is documented and pricing covers costs with margin
- [ ] All code is commented and documented

---

## 10. Monthly Operations Checklist

> **Instructions:** Review these items once a month to keep the project healthy.

- [ ] Review uptime and error reports — any patterns or recurring issues?
- [ ] Verify backups are still running and test a restore if it has been more than 3 months
- [ ] Review monthly costs — any unexpected charges or growth?
- [ ] Check for security updates on dependencies (run dependency audit)
- [ ] Review any user feedback or support requests — any patterns?
- [ ] Update this Project Context Document if any decisions have been made
- [ ] Update the Decision Log with any new decisions

---

*This is a living document. Keep it updated. It is the single source of truth for the FeedMyOwl project.*
