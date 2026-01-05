/**
 * Cloudflare Pages runtime config.
 * This file should be overwritten at deploy time by Pages ENV or build step.
 * DO NOT cache this file in CDN.
 */
window.__RUNTIME_CONFIG__ = {
  SUPABASE_URL: "http://localhost:54321",
  SUPABASE_ANON_KEY: "dev-anon-key",
  RAILWAY_API_BASE_URL: "http://localhost:8080",
  MAPBOX_TOKEN: "your-mapbox-token",
  POSTHOG_KEY: "phc_your_key",
  POSTHOG_HOST: "https://app.posthog.com"
};
