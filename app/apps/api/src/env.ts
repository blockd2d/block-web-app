import { z } from "zod";

export const EnvSchema = z.object({
  PORT: z.string().optional(),
  NODE_ENV: z.string().optional(),

  SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(10),
  SUPABASE_JWT_SECRET: z.string().min(10),

  RAILWAY_PUBLIC_URL: z.string().url().optional(),

  TWILIO_ACCOUNT_SID: z.string().min(5),
  TWILIO_AUTH_TOKEN: z.string().min(5),
  TWILIO_MESSAGING_SERVICE_SID: z.string().min(5),

  STRIPE_SECRET_KEY: z.string().min(5),
  STRIPE_WEBHOOK_SECRET: z.string().min(5),

  POSTHOG_API_KEY: z.string().optional(),
});

export type Env = z.infer<typeof EnvSchema>;

export function getEnv(): Env {
  const parsed = EnvSchema.safeParse(process.env);
  if (!parsed.success) {
    console.error(parsed.error.flatten().fieldErrors);
    throw new Error("Invalid environment variables");
  }
  return parsed.data;
}
