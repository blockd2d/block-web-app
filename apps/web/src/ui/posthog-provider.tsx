'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import posthog from 'posthog-js';

export function PosthogInit() {
  const pathname = usePathname();

  useEffect(() => {
    const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
    const host = process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://app.posthog.com';
    if (!key) return;

    try {
      posthog.init(key, {
        api_host: host,
        capture_pageview: false,
        capture_pageleave: true,
        autocapture: true
      });
    } catch {
      // noop
    }
  }, []);

  useEffect(() => {
    const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
    if (!key) return;
    try {
      posthog.capture('$pageview', {
        $current_url: typeof window !== 'undefined' ? window.location.href : pathname,
        path: pathname
      });
    } catch {
      // noop
    }
  }, [pathname]);

  return null;
}
