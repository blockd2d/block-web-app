# Block V7 (Monorepo)

**Block V7** is a multi-tenant, invite-only field sales + operations platform for door-to-door / field teams.

## Apps
- `apps/web` — Next.js (Vercel). **Managers/Admins only.**
- `apps/api` — Fastify API (Railway). Supabase is the source of truth.
- `apps/rep-mobile` — Rep mobile app (Sales Rep). **Mobile-only.**
- `apps/labor-mobile` — Labor mobile app (Field Tech). **Mobile-only.**
- `packages/shared` — shared schemas + event names.

## Core contracts implemented
- Invite-only onboarding (admin creates invites; invite accept creates user + cookie session)
- Role separation:
  - **admin / manager**: web login only (cookies)
  - **rep / labor**: mobile login only (bearer token)
- Territory clustering (async worker) + map overlays (web uses Mapbox)
- Rep tracking: `/v1/reps/me/location`, `/v1/reps/locations/latest`
- Messaging + Twilio webhook alias: `/v1/messages/twilio/inbound` and `/v1/twilio/inbound`
- Payments + Stripe webhook alias: `/v1/payments/stripe/webhook` and `/v1/stripe/webhook`
- Jobs alias for labor app: `/v1/jobs/*`

## Local dev
### 1) Install
```bash
pnpm i
```

### 2) Configure env
Copy `.env.example` → `.env` in the repo root (and optionally per-app).

Required highlights:
- `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- `NEXT_PUBLIC_API_URL` (web) and `EXPO_PUBLIC_API_URL` (mobile)
- `NEXT_PUBLIC_MAPBOX_TOKEN` for web maps
- `POSTHOG_*` optional
- `TWILIO_*`, `STRIPE_*` optional

### 3) Run migrations (Supabase)
Use Supabase CLI or dashboard SQL editor to run `supabase/migrations/*`.

### 4) Seed dev data (optional)
```bash
pnpm --filter @block/api seed:dev
```
This prints dev credentials (admin/manager/rep/labor) and creates a demo org with 2 counties.

### 5) Start API + Web
```bash
pnpm dev
```

Web entry points:
- Marketing: `/`
- Web auth: `/login`
- Web app: `/app/*` (dashboard, territories, reps, sales, follow-ups, messages, analytics, audit, settings)
- Invite acceptance: `/invite/accept?token=...`

> Mobile apps run separately (Expo/React Native).

## Deploy
See `docs/deployment.md`.

### Vercel monorepo build settings (Turborepo)

In Vercel → Project Settings → Build & Output Settings:

- **Root Directory**: `.` (repo root)
- **Install Command**: `pnpm install` *(or `pnpm install --no-frozen-lockfile` until you generate and commit a real `pnpm-lock.yaml`)*
- **Build Command**: `pnpm turbo run build --filter=@block/web`
- **Output Directory**: `apps/web/.next`

> Notes
> - The Next.js app lives in `apps/web`, but this is a workspace repo, so installs should happen from the repo root.
> - The web app talks ONLY to the Railway API (no Supabase client in the browser).

### Deploy checklist (Supabase → Railway → Vercel)

**1) Supabase**

1. Create a Supabase project.
2. Create private Storage buckets:
   - `contracts`
   - `exports`
   - `job-photos`
   - `attachments`
3. Apply all SQL migrations in `supabase/migrations/` in numeric order.
4. Seed demo data (recommended for first run):
   ```bash
   pnpm --filter @block/api seed:dev
   ```
   This creates a demo org, counties, reps, sales history, message threads, jobs, and uploads/exports scaffolding.

**2) Railway (API + Worker)**

1. Create a Railway service pointing at `apps/api`.
2. Use the included `apps/api/Procfile` to run **two processes**:
   - `web` (Fastify API)
   - `worker` (background processors)
3. Set Railway env vars (minimum):
   - `NODE_ENV=production`
   - `PORT=4000`
   - `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
   - `COOKIE_DOMAIN=.yourdomain.com`, `COOKIE_SECURE=true`
   - `WEB_BASE_URL=https://app.yourdomain.com`, `PUBLIC_WEB_URL=https://app.yourdomain.com`
   - `FEATURE_MESSAGES_INTERVENE=false` (default; enable only after Twilio is configured)
   - Optional: `POSTHOG_API_KEY`, `POSTHOG_HOST`
   - Optional: `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_NUMBER`
   - Optional: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`

**3) Vercel (Web)**

1. Create a Vercel project for `apps/web` (App Router).
2. Set env vars:
   - `NEXT_PUBLIC_API_URL=https://api.yourdomain.com`
   - `NEXT_PUBLIC_WEB_URL=https://app.yourdomain.com`
   - Optional: `NEXT_PUBLIC_POSTHOG_KEY`, `NEXT_PUBLIC_POSTHOG_HOST`
   - Optional: `NEXT_PUBLIC_MAPBOX_TOKEN`
   - Optional: `NEXT_PUBLIC_FEATURE_MESSAGES_INTERVENE=true` (must match the server flag)
3. (Optional) `apps/web/vercel.json` provides security headers.

**4) Mobile apps (Rep + Labor)**

Rep mobile (`apps/rep-mobile`) uses **react-native-config**:
- `BLOCK_API_URL=https://api.yourdomain.com`
- Optional: `POSTHOG_API_KEY`, `POSTHOG_HOST` (default `https://app.posthog.com`)
- Optional: `POSTHOG_ENABLED=true|false`

Labor mobile (`apps/labor-mobile`) uses **Expo public env vars**:
- `EXPO_PUBLIC_API_URL=https://api.yourdomain.com`
- Optional: `EXPO_PUBLIC_POSTHOG_API_KEY`, `EXPO_PUBLIC_POSTHOG_HOST`
- Optional: `EXPO_PUBLIC_POSTHOG_ENABLED=true|false`

**5) Cloudflare (recommended)**

1. Put DNS/WAF in front of both:
   - `app.yourdomain.com` → Vercel
   - `api.yourdomain.com` → Railway
2. Add rate limits on:
   - `/v1/auth/login`
   - `/v1/invites/accept`

**6) Webhooks**

Twilio inbound:
- `POST https://api.yourdomain.com/v1/messages/twilio/inbound`

Stripe webhook:
- `POST https://api.yourdomain.com/v1/payments/stripe/webhook`
