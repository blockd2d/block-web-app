# Block V7 Deployment Guide

This repo is a **monorepo** with:

- `apps/web` — Next.js (Vercel)
- `apps/api` — Fastify + workers (Railway)
- `apps/rep-mobile` — React Native Rep app (currently React Native CLI)
- `apps/labor-mobile` — Expo Labor app
- `packages/shared` — shared Zod schemas, types, clustering utils
- `supabase` — migrations, seed

Block V7 uses a **proxy pattern**:

- The **API service (Railway)** is the only layer that talks to **Supabase Postgres/Storage** using the **service role**.
- The **Web app (Vercel)** never does Supabase CRUD; it calls the API.
- **Mobile apps** authenticate against the API and then call API endpoints (bearer tokens). No direct DB access.

---

## 0) Prereqs

- Supabase project (Postgres + Storage)
- Railway project (Node service) for `apps/api`
- Vercel project for `apps/web`
- Cloudflare for DNS + WAF in front of Vercel + Railway
- PostHog project
- Twilio SMS number (optional in dev)
- Stripe account (optional in dev)

---

## 1) Supabase setup

### 1.1 Create storage buckets

Create buckets (private):

- `contracts`
- `exports`
- `job-photos`
- `attachments`

### 1.2 Run migrations

From repo root:

```bash
pnpm i
pnpm -C supabase db reset  # if using Supabase CLI locally
```

In hosted Supabase, apply SQL migrations in order:

Apply all SQL migrations in `supabase/migrations/` in numeric order. Current set:

- `supabase/migrations/0001_init.sql`
- `supabase/migrations/0002_daily_stats.sql`
- `supabase/migrations/0003_org_settings.sql`
- `supabase/migrations/0004_leaderboard.sql`
- `supabase/migrations/0005_job_photos.sql`
- `supabase/migrations/0006_v7_polish.sql`
- `supabase/migrations/0007_metrics_and_cluster_set_fields.sql`
- `supabase/migrations/0008_messages_outbound.sql`
- `supabase/migrations/0009_job_photos_signature.sql`
- `supabase/migrations/0010_sales_customer_and_view.sql`


### 1.3 Seed demo data

Run `supabase/seed.sql` in the SQL editor (or run `pnpm -C apps/api seed:dev` for a dev/demo seed).

---

## 2) Railway (API + workers)

### 2.1 Service

Create a Railway service for `apps/api`.

This repo includes `apps/api/Procfile` with two processes:

- `web` — Fastify API server
- `worker` — background worker loop

Build command:

```bash
pnpm -C apps/api build
```

Start command:

```bash
pnpm -C apps/api start
```

### 2.2 Required environment variables

Set these on Railway:

- `NODE_ENV=production`
- `PORT=4000`

Supabase:
- `SUPABASE_URL=...`
- `SUPABASE_ANON_KEY=...` (used for auth refresh flows)
- `SUPABASE_SERVICE_ROLE_KEY=...` (service role, **server-only**)

Cookies / CSRF:
- `COOKIE_DOMAIN=.yourdomain.com`
- `COOKIE_SECURE=true`
- `SESSION_COOKIE_NAME=block_session`
- `REFRESH_COOKIE_NAME=block_refresh`
- `CSRF_COOKIE_NAME=block_csrf`

URLs:
- `WEB_BASE_URL=https://app.yourdomain.com` (used for invite links)
- `PUBLIC_WEB_URL=https://app.yourdomain.com` (used for Stripe success/cancel)

Cloudflare Turnstile:
- `TURNSTILE_SECRET_KEY=...` (optional)
- `MOBILE_TURNSTILE_BYPASS=true` (recommended; mobile sends `x-block-client: mobile`)

PostHog:
- `POSTHOG_API_KEY=...`
- `POSTHOG_HOST=https://app.posthog.com` (or self-host)

Twilio (optional):
- `TWILIO_ACCOUNT_SID=...`
- `TWILIO_AUTH_TOKEN=...`
- `TWILIO_NUMBER=+1...`

Feature flags:
- `FEATURE_MESSAGES_INTERVENE=false` (default; allow managers/admins to send SMS from the web UI)

Stripe (optional):
- `STRIPE_SECRET_KEY=...`
- `STRIPE_WEBHOOK_SECRET=...`

### 2.3 Webhooks

Twilio inbound (set in Twilio Console):

- `POST https://api.yourdomain.com/v1/messages/twilio/inbound`

Stripe webhook endpoint:

- `POST https://api.yourdomain.com/v1/payments/stripe/webhook`

---

## 3) Vercel (Web)

### 3.1 Project

Create a Vercel project pointing at `apps/web`.

### 3.2 Env vars

Set on Vercel:

- `NEXT_PUBLIC_API_URL=https://api.yourdomain.com`
- `NEXT_PUBLIC_POSTHOG_KEY=...`
- `NEXT_PUBLIC_POSTHOG_HOST=https://app.posthog.com`
- `NEXT_PUBLIC_TURNSTILE_SITE_KEY=...` (optional)
- `NEXT_PUBLIC_MAPBOX_TOKEN=pk.***`

Feature flags:
- `NEXT_PUBLIC_FEATURE_MESSAGES_INTERVENE=true` (must match the server flag)

Optional headers:
- `apps/web/vercel.json`

### 3.3 Cookies across subdomains

The API sets cookies for the domain configured via `COOKIE_DOMAIN`.

Recommended DNS:

- `app.yourdomain.com` → Vercel
- `api.yourdomain.com` → Railway

Cookies:

- set `COOKIE_DOMAIN=.yourdomain.com`
- set `COOKIE_SECURE=true`

---

## 4) Cloudflare (DNS + WAF)

Recommended:

- Cloudflare manages DNS for `yourdomain.com`.
- `app` is a CNAME to Vercel.
- `api` is a CNAME to Railway.

WAF rules:

- Rate limit `/v1/auth/login` and `/v1/invites/accept`
- Block obvious bot ASNs/regions as needed
- Optional: Cloudflare Turnstile on `/login` and `/invite/accept`

Caching:

- Do **not** cache API responses (`api.yourdomain.com/*`), except static docs.

---

## 5) PostHog

Web uses PostHog client capture.

API captures server-side events via `apps/api/src/lib/posthog.ts`.

Event names are defined in `packages/shared/src/posthog.ts`.

### Mobile apps

- `apps/labor-mobile` (Expo): set `EXPO_PUBLIC_POSTHOG_API_KEY` (and optionally `EXPO_PUBLIC_POSTHOG_HOST`, `EXPO_PUBLIC_POSTHOG_ENABLED`).
- `apps/rep-mobile` (RN CLI): set `POSTHOG_API_KEY` (and optionally `POSTHOG_HOST`, `POSTHOG_ENABLED`) via react-native-config.

---

## 6) Local development

See repo root `README.md`.

---

## 7) Sign-in and first customers (e.g. Nova)

**Web app (Vercel)** must have `NEXT_PUBLIC_API_URL` set to the **Block API base URL** (e.g. your Railway API URL). If this is wrong or missing, sign-in requests will get 404 and login will fail. Before testing login, verify the API is reachable: `GET {API_URL}/health` should return `{"ok":true,...}`.

**Seeded users** (created by `pnpm --filter @block/api seed:dev`): the script prints admin/manager/rep/labor emails and the **seed password** (e.g. `Password123!`) to the console. Use that password for `manager+{suffix}@block.local` and `admin+{suffix}@block.local` (suffix is the 6-digit timestamp from the seed run). Share the printed credentials with the first customer (e.g. Nova Services) or document in an internal runbook.

To let a customer set their own password, use the **invite-accept flow**: create an invite (admin) and send the link; they set password at `/invite/accept?token=...`.

---

## 8) Production smoke checklist

- Can login via `/login` (admin/manager)
- Can create invite and accept it
- Can create cluster set and see progress go to 100%
- Can assign clusters and export assignments
- Can create a sale and generate a contract PDF
- Twilio inbound webhook stores messages
- Stripe checkout link works and webhook marks payment paid


## 9) Mapbox (Web)
The web app uses Mapbox for territories/cluster overlays.

Set:
- `NEXT_PUBLIC_MAPBOX_TOKEN` (Vercel)

If unset, the territories map will show a warning and render an empty panel.
