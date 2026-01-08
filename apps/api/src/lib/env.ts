import { z } from 'zod';

const Bool = z.preprocess((v) => {
  if (typeof v === 'string') return v === 'true' || v === '1';
  return v;
}, z.boolean());

const EnvSchema = z.object({
  NODE_ENV: z.string().default('development'),
  PORT: z.string().default('4000'),

  SUPABASE_URL: z.string().url(),
  SUPABASE_ANON_KEY: z.string().min(10),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(10),

  COOKIE_DOMAIN: z.string().default('localhost'),
  COOKIE_SECURE: Bool.default(false),
  SESSION_COOKIE_NAME: z.string().default('block_session'),
  REFRESH_COOKIE_NAME: z.string().default('block_refresh'),
  CSRF_COOKIE_NAME: z.string().default('block_csrf'),

  WEB_BASE_URL: z.string().default('http://localhost:3000'),

  TURNSTILE_SECRET_KEY: z.string().optional().default(''),
  MOBILE_TURNSTILE_BYPASS: Bool.default(true),

  POSTHOG_API_KEY: z.string().optional().default(''),
  POSTHOG_HOST: z.string().optional().default('https://app.posthog.com'),

  TWILIO_ACCOUNT_SID: z.string().optional().default(''),
  TWILIO_AUTH_TOKEN: z.string().optional().default(''),
  TWILIO_NUMBER: z.string().optional().default(''),

  STRIPE_SECRET_KEY: z.string().optional().default(''),
  STRIPE_WEBHOOK_SECRET: z.string().optional().default(''),
  PUBLIC_WEB_URL: z.string().optional().default('http://localhost:3000')
});

export const env = EnvSchema.parse(process.env);
export type Env = typeof env;
