import PostHog from 'posthog-react-native';
import Config from 'react-native-config';

let client: PostHog | null = null;

function truthy(v: any) {
  const s = String(v ?? '').toLowerCase();
  return s === 'true' || s === '1' || v === 1 || v === true;
}

export function posthog() {
  if (client) return client;

  const apiKey = (Config.POSTHOG_API_KEY || Config.POSTHOG_KEY || '') as string;
  const host = (Config.POSTHOG_HOST || 'https://app.posthog.com') as string;
  const enabled = !String(Config.POSTHOG_ENABLED ?? 'true').length ? true : truthy(Config.POSTHOG_ENABLED);

  // If API key is not set, initialize as disabled so builds/tests still pass.
  client = new PostHog(apiKey || 'phc_placeholder', {
    host,
    disabled: !enabled || !apiKey,
    captureApplicationLifecycleEvents: true
  });

  return client;
}

export function phCapture(event: string, properties?: Record<string, any>) {
  try {
    posthog().capture(event, properties);
  } catch {
    // noop
  }
}

export function phIdentify(user: { id: string; email?: string | null; role?: string | null; org_id?: string | null }) {
  try {
    posthog().identify(user.id, {
      email: user.email || undefined,
      role: user.role || undefined,
      org_id: user.org_id || undefined
    });
  } catch {
    // noop
  }
}

export function phReset() {
  try {
    posthog().reset();
  } catch {
    // noop
  }
}
