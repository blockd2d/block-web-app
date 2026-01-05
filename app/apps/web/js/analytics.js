/**
 * Block V6: PostHog analytics bootstrap
 * - Reads runtime config from window.BLOCK_CONFIG (generated at build time into /config.js)
 * - Loads PostHog only if POSTHOG_KEY is set
 */
(function () {
  try {
    const cfg = (window.BLOCK_CONFIG || {});
    const key = cfg.POSTHOG_KEY;
    const host = cfg.POSTHOG_HOST || "https://app.posthog.com";
    if (!key) return;

    // Lightweight PostHog snippet (no dependencies)
    // Loads script async and initializes once loaded
    const s = document.createElement("script");
    s.async = true;
    s.src = host.replace(/\/$/, "") + "/static/array.js";
    s.onload = function () {
      if (!window.posthog || !window.posthog.init) return;
      window.posthog.init(key, {
        api_host: host,
        autocapture: true,
        capture_pageview: true,
      });
      window.posthog.capture("app_open", { page: location.pathname });
    };
    document.head.appendChild(s);
  } catch (e) {
    // swallow
  }
})();
