# Block V7 — Production Deployment

This repo is a **Turborepo pnpm workspace**:

- `apps/web` — Next.js (Vercel)
- `apps/api` — Fastify API + background worker (Railway)
- `apps/rep-mobile` — React Native CLI (Rep app)
- `apps/labor-mobile` — Expo (Labor app)
- `supabase` — SQL migrations + seed

**Proxy pattern (non-negotiable)**

- The **API** is the only layer that talks to Supabase Postgres/Storage (service role)
- The **Web** never does Supabase CRUD; it calls the API using cookies (CSRF protected)
- The **Mobile apps** call the API using bearer tokens

---

## 1) Supabase setup

### 1.1 Create a Supabase project

Create a new Supabase project and copy:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (server-only)

### 1.2 Storage buckets

Create **private** buckets:

- `contracts` (generated contract PDFs)
- `exports` (CSV/JSON exports)
- `job-photos` (labor job photos)
- `attachments` (sale/job attachments + signatures)

> The web app never signs or fetches storage URLs directly. The API returns **signed URLs**.

### 1.3 Apply migrations

Apply all SQL files in `supabase/migrations/` in numeric order:

- `0001_init.sql`
- `0002_daily_stats.sql`
- `0003_org_settings.sql`
- `0004_leaderboard.sql`
- `0005_job_photos.sql`
- `0006_v7_polish.sql`
- `0007_metrics_and_cluster_set_fields.sql`
- `0008_messages_outbound.sql`
- `0009_job_photos_signature.sql`
- `0010_sales_customer_and_view.sql`

### 1.4 Seed (optional)

Run `supabase/seed.sql` in the SQL editor, or seed via API:

```bash
pnpm --filter @block/api seed:dev
```

---

## 2) Railway deploy (API + worker)

### 2.1 Create the Railway service

Create a Railway project and add a Node service pointing at this repo.

- **Root**: repo root
- **Build Command**:
  - `pnpm --filter @block/api build`
- **Start Command**:
  - `pnpm --filter @block/api start`

This repo includes `apps/api/Procfile` that runs two processes:

- `web` — Fastify API server
- `worker` — background jobs (exports, clustering, contract generation)

Make sure Railway is configured to run both.

### 2.2 Railway environment variables

**Required**

- `NODE_ENV=production`
- `PORT=4000`

Supabase:
- `SUPABASE_URL=...`
- `SUPABASE_ANON_KEY=...`
- `SUPABASE_SERVICE_ROLE_KEY=...`

Cookies / CSRF:
- `COOKIE_DOMAIN=.yourdomain.com`
- `COOKIE_SECURE=true`
- `SESSION_COOKIE_NAME=block_session`
- `REFRESH_COOKIE_NAME=block_refresh`
- `CSRF_COOKIE_NAME=block_csrf`

URLs:
- `WEB_BASE_URL=https://app.yourdomain.com`
- `PUBLIC_WEB_URL=https://app.yourdomain.com`

PostHog (optional):
- `POSTHOG_API_KEY=...`
- `POSTHOG_HOST=https://app.posthog.com`

Twilio (optional for messaging):
- `TWILIO_ACCOUNT_SID=...`
- `TWILIO_AUTH_TOKEN=...`
- `TWILIO_NUMBER=+1...`

Stripe (optional for labor payment links + webhook):
- `STRIPE_SECRET_KEY=...`
- `STRIPE_WEBHOOK_SECRET=...`

Feature flags:
- `FEATURE_MESSAGES_INTERVENE=false` (default)

---

## 3) Vercel deploy (Web)

### 3.1 Vercel Build & Output settings (Turborepo)

In Vercel → Project Settings → Build & Output Settings:

- **Root Directory**: `.`
- **Install Command**: `pnpm install`
  - If your CI uses frozen lockfiles and you haven't committed a real `pnpm-lock.yaml` yet: `pnpm install --no-frozen-lockfile`
- **Build Command**: `pnpm turbo run build --filter=@block/web`
- **Output Directory**: `apps/web/.next`

### 3.2 Vercel environment variables

Required:

- `NEXT_PUBLIC_API_URL=https://api.yourdomain.com`
- `NEXT_PUBLIC_WEB_URL=https://app.yourdomain.com`

Optional:

- `NEXT_PUBLIC_MAPBOX_TOKEN=pk.***`
- `NEXT_PUBLIC_POSTHOG_KEY=...`
- `NEXT_PUBLIC_POSTHOG_HOST=https://app.posthog.com`
- `NEXT_PUBLIC_FEATURE_MESSAGES_INTERVENE=true|false` (should match the API flag)

---

## 4) Webhook configuration

### 4.1 Twilio inbound SMS

Twilio Console → Phone Number → Messaging → A message comes in:

- **Webhook URL**: `POST https://api.yourdomain.com/v1/messages/twilio/inbound`

(There is also an alias endpoint: `POST /v1/twilio/inbound`.)

### 4.2 Stripe webhook

Stripe Dashboard → Developers → Webhooks:

- **Endpoint**: `POST https://api.yourdomain.com/v1/payments/stripe/webhook`

(There is also an alias endpoint: `POST /v1/stripe/webhook`.)

Set `STRIPE_WEBHOOK_SECRET` on Railway.

---

## 5) DNS / Cookies

Recommended DNS:

- `app.yourdomain.com` → Vercel
- `api.yourdomain.com` → Railway

Cookie setup:

- API must set cookies for `COOKIE_DOMAIN=.yourdomain.com`
- `COOKIE_SECURE=true` in production

---

## 6) Production smoke tests

- Login via `/login` (admin/manager)
- Navigate to `/app/sales` and confirm list loads + filters work
- Open a sale `/app/sales/:id` and confirm:
  - attachments show via signed URLs
  - contract link opens (if present)
  - audit events render
- Create an export (Sales or Assignments) and download from Exports
- Twilio inbound webhook stores messages (if Twilio configured)
- Stripe webhook marks payments paid (if Stripe configured)
