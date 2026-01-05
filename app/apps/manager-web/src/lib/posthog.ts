import posthog from "posthog-js";
import { getConfig } from "../config";

export function initPosthog() {
  const cfg = getConfig();
  posthog.init(cfg.POSTHOG_KEY, {
    api_host: cfg.POSTHOG_HOST || "https://app.posthog.com",
    autocapture: true,
    capture_pageview: true,
  });
  return posthog;
}
