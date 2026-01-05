# Block V7 – Deployment

This repo targets:
- Cloudflare Pages: Manager Web
- Railway: API + Worker
- Supabase: Auth + Postgres + Storage + Realtime
- PostHog: Web + Mobile analytics
- Twilio: SMS via Railway
- Stripe: Payments via Railway

## Supabase
1. Create a Supabase project.
2. Enable **Email/Password** auth only.
3. Run migrations:
   - Using Supabase CLI linked to project:
     ```bash
     supabase link --project-ref <ref>
     supabase migration up
     ```
4. Create storage buckets:
   - `exports` (private)
   - `job-media` (private)
   - `contracts` (private)
   Add bucket policies (TODO: policy SQL not included in this zip template).

## Railway
Create **two services** (recommended):
- `block-api` (web)
- `block-worker` (background)

Both built from `apps/api`.

### Environment Variables (both services)
- SUPABASE_URL
- SUPABASE_SERVICE_ROLE_KEY
- SUPABASE_JWT_SECRET
- TWILIO_ACCOUNT_SID
- TWILIO_AUTH_TOKEN
- TWILIO_MESSAGING_SERVICE_SID
- STRIPE_SECRET_KEY
- STRIPE_WEBHOOK_SECRET
- RAILWAY_PUBLIC_URL (API public URL)  **required for Twilio signature validation**

### Start commands
- API service: `node dist/server.js`
- Worker service: `node dist/worker.js`

### Webhooks
- Twilio inbound webhook:
  - POST `{RAILWAY_PUBLIC_URL}/webhooks/twilio/inbound`
  - NOTE: This template expects `OrgId` in the request. Replace with number->org mapping for production.
- Stripe webhook:
  - POST `{RAILWAY_PUBLIC_URL}/webhooks/stripe`

## Cloudflare Pages (Manager Web)
Build settings:
- Root: `apps/manager-web`
- Build command: `pnpm install --frozen-lockfile || pnpm install && pnpm build`
- Output directory: `dist`

Environment variables (Pages):
- SUPABASE_URL
- SUPABASE_ANON_KEY
- RAILWAY_API_BASE_URL
- MAPBOX_TOKEN
- POSTHOG_KEY
- POSTHOG_HOST

This writes `dist/runtime-config.js` during build.

## Mobile Apps
### Labor
Set Expo env vars:
- EXPO_PUBLIC_SUPABASE_URL
- EXPO_PUBLIC_SUPABASE_ANON_KEY
- EXPO_PUBLIC_RAILWAY_API_BASE_URL
- EXPO_PUBLIC_POSTHOG_KEY
- EXPO_PUBLIC_POSTHOG_HOST
- EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY

Build with EAS (recommended).

### Rep
The rep app is included as `_import_raw` and needs V7 adaptation.

