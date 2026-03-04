'use client';

import * as React from 'react';
import dynamic from 'next/dynamic';
import { usePathname, useRouter } from 'next/navigation';
import { AppShell } from '../../ui/shell';
import { MeProvider } from '../../ui/me-provider';
import { ThemeProvider } from '../../ui/theme-context';
import { FullPageSpinner } from '../../ui/spinner';
import { Button } from '../../ui/button';
import { useMe } from '../../lib/use-me';

const PosthogInit = dynamic(
  () => import('../../ui/posthog-provider').then((m) => m.PosthogInit),
  { ssr: false }
);

function pageTitleFromPath(pathname: string | null): string {
  if (!pathname || !pathname.startsWith('/app')) return 'Block';
  const path = pathname.replace(/^\/app\/?/, '') || 'dashboard';
  const segment = path.split('/')[0];
  const map: Record<string, string> = {
    dashboard: 'Dashboard',
    leads: 'Leads',
    sales: 'Sales',
    quotes: 'Quotes',
    territories: 'Territories',
    knocks: 'Knocks',
    crews: 'Crews',
    settings: 'Settings',
    reps: 'Reps',
    messages: 'Messages',
    exports: 'Exports',
    analytics: 'Analytics',
    assignments: 'Assignments',
    followups: 'Follow-ups',
    operations: 'Operations',
    audit: 'Audit',
    invoices: 'Invoices',
    schedule: 'Schedule',
    zones: 'Zones'
  };
  if (path === 'leads/new') return 'New lead';
  if (path === 'leads/map') return 'Lead map';
  if (path === 'quotes/new') return 'New quote';
  if (segment === 'sales' && path !== 'sales') return 'Sale';
  if (segment === 'territories' && path !== 'territories' && path !== 'territories/zones') return 'Territory';
  return map[segment] || segment.charAt(0).toUpperCase() + segment.slice(1).replace(/-/g, ' ');
}

function ProtectedShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { me, loading, error, refresh } = useMe();

  React.useEffect(() => {
    document.title = 'Block - ' + pageTitleFromPath(pathname);
  }, [pathname]);

  React.useEffect(() => {
    if (loading) return;
    if (me) return;
    // Auth failure (or unknown error) => send to sign in.
    const next = pathname && pathname.startsWith('/app') ? pathname : '/app/dashboard';
    router.replace(`/login?next=${encodeURIComponent(next)}`);
  }, [loading, me, router, pathname]);

  if (loading) return <FullPageSpinner label="Loading your workspace…" />;

  if (!me) {
    // While redirecting.
    if (!error) return <FullPageSpinner label="Redirecting to sign in…" />;
    return (
      <div className="min-h-[70vh] grid place-items-center p-6">
        <div className="w-full max-w-md rounded-2xl border border-border bg-card p-5 shadow-soft">
          <div className="text-base font-semibold">Couldn’t load your session</div>
          <div className="mt-1 text-sm text-mutedForeground">{error.message}</div>
          <div className="mt-4 flex gap-2">
            <Button onClick={() => refresh()} variant="secondary">
              Retry
            </Button>
            <Button onClick={() => router.replace('/login')}>Go to sign in</Button>
          </div>
        </div>
      </div>
    );
  }

  return <AppShell me={me}>{children}</AppShell>;
}

// In dev, suppress error overlay for known third-party (e.g. PostHog ingest) network failures.
function useDevThirdPartyRejectionFilter() {
  React.useEffect(() => {
    if (process.env.NODE_ENV !== 'development' || typeof window === 'undefined') return;
    const handler = (event: PromiseRejectionEvent) => {
      const s =
        typeof event.reason === 'string'
          ? event.reason
          : event.reason?.message ?? event.reason?.toString?.() ?? '';
      const lower = s.toLowerCase();
      if (lower.includes('posthog') || lower.includes('ingest')) {
        event.preventDefault();
      }
    };
    window.addEventListener('unhandledrejection', handler);
    return () => window.removeEventListener('unhandledrejection', handler);
  }, []);
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  useDevThirdPartyRejectionFilter();
  return (
    <ThemeProvider>
      <PosthogInit />
      <MeProvider>
        <ProtectedShell>{children}</ProtectedShell>
      </MeProvider>
    </ThemeProvider>
  );
}

