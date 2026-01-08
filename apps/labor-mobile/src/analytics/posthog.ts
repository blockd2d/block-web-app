import { PostHog } from 'posthog-react-native';

// Expo public env vars
const API_KEY = process.env.EXPO_PUBLIC_POSTHOG_KEY;
const HOST = process.env.EXPO_PUBLIC_POSTHOG_HOST || 'https://app.posthog.com';

let client: PostHog | null = null;

export function posthog() {
  if (!API_KEY) return null;
  if (!client) {
    // captureApplicationLifecycleEvents helps track app opens/foreground/background
    client = new PostHog(API_KEY, {
      host: HOST,
      captureApplicationLifecycleEvents: true
    });
  }
  return client;
}

export function identify(distinctId: string, properties?: Record<string, any>) {
  const ph = posthog();
  if (!ph) return;
  try {
    ph.identify(distinctId, properties);
  } catch {
    // noop
  }
}

export function capture(event: string, properties?: Record<string, any>) {
  const ph = posthog();
  if (!ph) return;
  try {
    ph.capture(event, properties);
  } catch {
    // noop
  }
}

export function reset() {
  const ph = posthog();
  if (!ph) return;
  try {
    ph.reset();
  } catch {
    // noop
  }
}
