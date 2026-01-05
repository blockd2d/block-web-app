# Block V6 (Deploy Ready)

This repo is a deploy-friendly packaging of **Block V6** (offline-first territory + sales manager web app),
prepared for **GitHub**, **Cloudflare Pages**, **Supabase**, **Railway**, and **PostHog**.

## What’s inside
- `apps/web` — the Block V6 web app (static multi-page PWA)
- `apps/api` — optional Railway service (health endpoint + future API surface)
- `supabase` — migrations + edge function templates (Twilio-ready placeholders)
- `scripts/build.mjs` — produces `dist/` with runtime `config.js` from env vars
- PostHog bootstrap: `apps/web/js/analytics.js`

---

## 1) Quick start (local)
```bash
npm i
npm run dev
```
Then open http://localhost:5173 (or whatever the dev server prints).

> Block V6 still works offline-first; Cloudflare deploy is recommended for sharing.

---

## 2) Cloudflare Pages deploy (recommended)
1. Push this repo to GitHub.
2. In Cloudflare Pages: **Create project** → connect GitHub repo.
3. Set:
   - **Build command:** `npm run build`
   - **Build output directory:** `dist`
4. Add environment variables (optional but recommended):
   - `POSTHOG_KEY`
   - `POSTHOG_HOST` (default: https://app.posthog.com)
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`
   - `API_BASE_URL` (if you deploy `apps/api` on Railway)

Cloudflare will build `dist/` and serve it. The app reads runtime config from `dist/config.js`.

---

## 3) PostHog events (already wired)
If `POSTHOG_KEY` is set at build time, the app loads PostHog and fires:
- `app_open` with `{ page }`

You can add more captures from app code (e.g. `window.posthog.capture(...)`).

---

## 4) Railway (optional API service)
Railway is not required for V6 (it’s static). We include `apps/api` as a minimal deploy target.

### Deploy
- Create a new Railway project → **Deploy from GitHub**
- Select this repo
- Set **Root Directory** to `apps/api`
- Add env vars as needed (example in `.env.example`)

It exposes:
- `GET /health`

---

## 5) Supabase (optional sync foundation)
V6 is local-first by default. This repo includes a safe starting point for adding sync.

### Migrations
- `supabase/migrations/0001_init.sql` creates tables and RLS scaffolding.

### Edge Functions (templates)
- `supabase/functions/twilio-send-sms`
- `supabase/functions/twilio-inbound`

> If you enable Supabase integration in the UI later, use `SUPABASE_URL` + `SUPABASE_ANON_KEY`.

---

## 6) Environment variables
Copy `.env.example` to `.env` for local builds.

---

## Build
```bash
npm run build
npm run preview
```
