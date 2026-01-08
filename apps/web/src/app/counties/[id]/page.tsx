'use client';

import { useEffect, useState } from 'react';
import { api } from '../../../lib/api';
import { AppShell } from '../../../ui/shell';
import { Button } from '../../../ui/button';
import Link from 'next/link';

export default function CountyDetail({ params }: { params: { id: string } }) {
  const countyId = params.id;
  const [me, setMe] = useState<any>(null);
  const [props, setProps] = useState<any[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.get('/v1/auth/me').then((r) => setMe(r.user)).catch(() => (window.location.href = '/login'));
    load(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [countyId]);

  async function load(reset = false) {
    setLoading(true);
    try {
      const q = reset ? '' : cursor ? `&cursor=${encodeURIComponent(cursor)}` : '';
      const r = await api.get(`/v1/properties?county_id=${encodeURIComponent(countyId)}&limit=1000${q}`);
      setProps(reset ? r.properties : [...props, ...(r.properties || [])]);
      setCursor(r.nextCursor || null);
    } finally {
      setLoading(false);
    }
  }

  return (
    <AppShell active="counties" me={me}>
      <div className="p-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-2xl font-semibold">County</h1>
            <p className="text-sm text-mutedForeground">{countyId}</p>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/cluster-sets" className="text-sm text-primary hover:opacity-90">
              Go to Cluster Sets →
            </Link>
          </div>
        </div>

        <div className="mt-6 rounded-2xl border border-border bg-card p-4 shadow-soft">
          <div className="text-sm text-mutedForeground">
            Loaded properties: <span className="text-foreground">{props.length}</span>
          </div>
          <div className="mt-3">
            <Button disabled={loading || !cursor} onClick={() => load(false)}>
              {loading ? 'Loading…' : cursor ? 'Load more' : 'No more'}
            </Button>
          </div>
          <div className="mt-4 max-h-[520px] overflow-auto text-xs text-mutedForeground">
            {props.slice(0, 200).map((p) => (
              <div key={p.id} className="border-b border-border/60 py-1">
                {p.address1 || '—'} • {p.lat.toFixed(4)},{p.lng.toFixed(4)} • {p.value_estimate ?? '—'}
              </div>
            ))}
            {props.length > 200 ? <div className="mt-2 text-mutedForeground">Showing first 200…</div> : null}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
