'use client';

import Link from 'next/link';
import * as React from 'react';
import { useParams } from 'next/navigation';
import { Button } from '../../../../ui/button';

type JoinStatus = 'pending' | 'approved' | 'rejected' | 'cancelled';

type JoinStatusResponse = {
  status: JoinStatus;
  company_name?: string | null;
  created_at?: string | null;
  decision_reason?: string | null;
};

function Section({ children }: { children: React.ReactNode }) {
  return <section className="mx-auto w-full max-w-6xl px-6">{children}</section>;
}

export default function JoinStatusPage() {
  const params = useParams<{ token: string }>();
  const token = typeof params?.token === 'string' ? params.token : '';

  const [data, setData] = React.useState<JoinStatusResponse | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [cancelling, setCancelling] = React.useState(false);

  const load = React.useCallback(async () => {
    if (!token) return;
    setError(null);
    setLoading(true);
    try {
      const r = await fetch(`/api/join/status?token=${encodeURIComponent(token)}`, {
        method: 'GET',
        cache: 'no-store'
      });
      const body = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(body?.error || 'Unable to load status');
      setData(body as JoinStatusResponse);
    } catch (e: any) {
      setData(null);
      setError(e?.message || 'Unable to load status');
    } finally {
      setLoading(false);
    }
  }, [token]);

  React.useEffect(() => {
    load().catch(() => {});
  }, [load]);

  async function cancel() {
    if (!token) return;
    if (!confirm('Cancel this request? This cannot be undone.')) return;
    setCancelling(true);
    setError(null);
    try {
      const r = await fetch('/api/join/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token })
      });
      const body = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(body?.error || 'Unable to cancel');
      await load();
    } catch (e: any) {
      setError(e?.message || 'Unable to cancel');
    } finally {
      setCancelling(false);
    }
  }

  return (
    <main className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <Section>
          <div className="flex h-16 items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="grid h-9 w-9 place-items-center rounded-xl bg-primary text-primaryForeground shadow-soft">
                <span className="text-sm font-extrabold">B</span>
              </div>
              <div className="leading-tight">
                <div className="text-sm font-semibold">Block</div>
                <div className="text-xs text-mutedForeground">Join status</div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Link href="/join">
                <Button variant="secondary" size="sm">
                  New request
                </Button>
              </Link>
              <Link href="/login">
                <Button size="sm">Sign in</Button>
              </Link>
            </div>
          </div>
        </Section>
      </header>

      <Section>
        <div className="py-12">
          <div className="max-w-2xl">
            <h1 className="text-3xl font-extrabold tracking-tight">Request status</h1>
            <p className="mt-2 text-sm text-mutedForeground">
              This page doesn’t require an account. Keep this link bookmarked.
            </p>
          </div>

          <div className="mt-8 rounded-3xl border border-border bg-card p-6 shadow-soft">
            {loading ? (
              <div className="text-sm text-mutedForeground">Loading…</div>
            ) : error ? (
              <div className="text-sm text-destructive">{error}</div>
            ) : !data ? (
              <div className="text-sm text-mutedForeground">Not found.</div>
            ) : (
              <>
                <div className="text-sm text-mutedForeground">Status</div>
                <div className="mt-1 text-xl font-semibold capitalize">{data.status}</div>

                {data.company_name ? (
                  <div className="mt-4 text-sm text-mutedForeground">
                    Company: <span className="text-foreground">{data.company_name}</span>
                  </div>
                ) : null}

                {data.status === 'pending' ? (
                  <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                    <Button variant="destructive" disabled={cancelling} onClick={cancel}>
                      {cancelling ? 'Cancelling…' : 'Cancel request'}
                    </Button>
                    <Link href="/join">
                      <Button variant="secondary">Back to Join</Button>
                    </Link>
                  </div>
                ) : null}

                {data.status === 'approved' ? (
                  <div className="mt-4 text-sm text-mutedForeground">
                    You’re approved. Check your email for an invite to set your password. Then{' '}
                    <Link href="/login" className="underline underline-offset-4">
                      sign in
                    </Link>
                    .
                  </div>
                ) : null}

                {data.status === 'rejected' ? (
                  <div className="mt-4 text-sm text-mutedForeground">
                    {data.decision_reason ? (
                      <>
                        <div className="font-medium text-foreground">Reason</div>
                        <div className="mt-1">{data.decision_reason}</div>
                      </>
                    ) : (
                      'Your request was not approved.'
                    )}
                  </div>
                ) : null}

                {data.status === 'cancelled' ? (
                  <div className="mt-4 text-sm text-mutedForeground">
                    This request has been cancelled. You can submit a new request any time.
                    <div className="mt-4">
                      <Link href="/join">
                        <Button>Submit new request</Button>
                      </Link>
                    </div>
                  </div>
                ) : null}
              </>
            )}
          </div>
        </div>
      </Section>
    </main>
  );
}

