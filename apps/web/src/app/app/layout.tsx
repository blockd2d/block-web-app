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

function ProtectedShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { me, loading, error, refresh } = useMe();

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

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <PosthogInit />
      <MeProvider>
        <ProtectedShell>{children}</ProtectedShell>
      </MeProvider>
    </ThemeProvider>
  );
}

