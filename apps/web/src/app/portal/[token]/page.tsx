'use client';

import * as React from 'react';
import { useParams } from 'next/navigation';
import { api } from '../../../lib/api';

export default function PortalPage() {
  const params = useParams<{ token: string }>();
  const token = params.token;
  const [status, setStatus] = React.useState<'loading' | 'ok' | 'error'>('loading');
  const [data, setData] = React.useState<any>(null);
  const [message, setMessage] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!token) {
      setStatus('error');
      setMessage('Missing token');
      return;
    }
    api
      .get(`/v1/portal/invoice?token=${encodeURIComponent(token)}`)
      .then((r) => {
        setData(r);
        setStatus('ok');
      })
      .catch(() => {
        setStatus('error');
        setMessage('Invalid or expired link. Customer portal requires backend endpoint GET /v1/portal/invoice?token=…');
      });
  }, [token]);

  if (status === 'loading') {
    return (
      <div className="min-h-screen grid place-items-center p-6">
        <div className="text-mutedForeground">Loading…</div>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="min-h-screen grid place-items-center p-6">
        <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-soft">
          <h1 className="text-xl font-semibold">Customer portal</h1>
          <p className="mt-2 text-sm text-mutedForeground">{message}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-6">
      <div className="mx-auto max-w-2xl rounded-2xl border border-border bg-card p-6 shadow-soft">
        <h1 className="text-xl font-semibold">Invoice</h1>
        {data ? (
          <pre className="mt-4 overflow-auto rounded-xl bg-muted p-4 text-xs">{JSON.stringify(data, null, 2)}</pre>
        ) : (
          <p className="mt-4 text-sm text-mutedForeground">No data.</p>
        )}
      </div>
    </div>
  );
}
