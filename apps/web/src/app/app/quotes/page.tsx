'use client';

import * as React from 'react';
import Link from 'next/link';
import { api } from '../../../lib/api';
import { Button } from '../../../ui/button';
import { fmtCurrency } from '../../../lib/format';

type QuoteRow = {
  id: string;
  created_at: string;
  rep_id: string;
  rep_name?: string | null;
  pipeline_status: string;
  price?: number | null;
  customer_name?: string | null;
  address1?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
};

function fmtDate(ts?: string) {
  if (!ts) return '—';
  try {
    return new Date(ts).toLocaleDateString();
  } catch {
    return ts;
  }
}

function fmtAddress(r: QuoteRow) {
  const line = [r.address1, r.city, r.state, r.zip].filter(Boolean).join(', ');
  return line || '—';
}

export default function QuotesPage() {
  const [rows, setRows] = React.useState<QuoteRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [err, setErr] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    setErr(null);
    setLoading(true);
    try {
      const r = await api.get('/v1/sales?status=quote&limit=200');
      setRows((r.items || r.sales || []) as QuoteRow[]);
    } catch (e: any) {
      setErr(e?.message || 'Failed to load quotes');
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="p-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Quotes</h1>
          <p className="mt-1 text-sm text-mutedForeground">Sales in quote stage. Convert to sold or update.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => load()} disabled={loading}>
            {loading ? 'Refreshing…' : 'Refresh'}
          </Button>
          <Link href="/app/quotes/new">
            <Button>New quote</Button>
          </Link>
        </div>
      </div>

      {err ? (
        <div className="mt-4 rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructiveForeground">
          {err}
        </div>
      ) : null}

      <div className="mt-6 rounded-2xl border border-border bg-card shadow-soft">
        <div className="grid grid-cols-[120px_1fr_1.2fr_120px_100px] gap-3 border-b border-border px-4 py-3 text-xs font-semibold text-mutedForeground">
          <div>Date</div>
          <div>Customer</div>
          <div>Address</div>
          <div>Rep</div>
          <div className="text-right">Price</div>
        </div>
        <div className="divide-y divide-border">
          {loading && rows.length === 0 ? (
            <div className="px-4 py-6 text-sm text-mutedForeground">Loading quotes…</div>
          ) : null}
          {rows.map((s) => (
            <Link
              key={s.id}
              href={`/app/sales/${s.id}`}
              className="grid grid-cols-[120px_1fr_1.2fr_120px_100px] gap-3 px-4 py-3 hover:bg-muted/40"
            >
              <div className="text-sm text-mutedForeground">{fmtDate(s.created_at)}</div>
              <div className="truncate text-sm font-medium">{s.customer_name || '—'}</div>
              <div className="truncate text-sm text-mutedForeground">{fmtAddress(s)}</div>
              <div className="truncate text-sm text-mutedForeground">{s.rep_name || s.rep_id?.slice(0, 8) + '…'}</div>
              <div className="text-right text-sm font-medium">{fmtCurrency(s.price)}</div>
            </Link>
          ))}
          {!loading && rows.length === 0 ? (
            <div className="px-4 py-8 text-sm text-mutedForeground">No quotes yet.</div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
