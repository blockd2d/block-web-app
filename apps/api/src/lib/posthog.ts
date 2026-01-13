import { PostHog } from 'posthog-node';
import { env } from './env';

let client: PostHog | null = null;

export function posthog() {
  if (!env.POSTHOG_API_KEY) return null;
  if (!client) client = new PostHog(env.POSTHOG_API_KEY, { host: env.POSTHOG_HOST });
  return client;
}

export async function capture(event: string, distinctId: string, properties: Record<string, any>) {
  const ph = posthog();
  if (!ph) return;
  ph.capture({ distinctId, event, properties });
}

export async function shutdownPosthog() {
  if (client) await client.shutdown();
}
