'use client';

import * as React from 'react';
import Link from 'next/link';
import { api } from '../../../lib/api';
import { Button } from '../../../ui/button';
import { fmtCurrency } from '../../../lib/format';

type LeadRow = {
  id: string;
  created_at: string;
  rep_id: string;
  rep_name?: string | null;
  pipeline_status: string;
  price?: number | null;
  customer_name?: string | null;
  customer_phone?: string | null;
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

function fmtAddress(r: LeadRow) {
  const line = [r.address1, r.city, r.state, r.zip].filter(Boolean).join(', ');
  return line || '—';
}

export default function LeadsPage() {
  const [rows, setRows] = React.useState<LeadRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [err, setErr] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    setErr(null);
    setLoading(true);
    try {
      const r = await api.get('/v1/sales?status=lead&limit=200');
      setRows((r.items || r.sales || []) as LeadRow[]);
    } catch (e: any) {
      setErr(e?.message || 'Failed to load leads');
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
          <h1 className="text-2xl font-semibold">Leads</h1>
          <p className="mt-1 text-sm text-mutedForeground">Pipeline leads (manual entry and field)</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => load()} disabled={loading}>
            {loading ? 'Refreshing…' : 'Refresh'}
          </Button>
          <Link href="/app/leads/new">
            <Button>Add lead</Button>
          </Link>
          <Link href="/app/leads/map">
            <Button variant="secondary">Lead map</Button>
          </Link>
        </div>
      </div>

      {err ? (
        <div className="mt-4 rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructiveForeground">
          {err}
        </div>
      ) : null}

      <div className="mt-6 rounded-2xl border border-border bg-card shadow-soft">
        <div className="grid grid-cols-[120px_1fr_1.2fr_140px_100px] gap-3 border-b border-border px-4 py-3 text-xs font-semibold text-mutedForeground">
          <div>Date</div>
          <div>Customer</div>
          <div>Address</div>
          <div>Rep</div>
          <div className="text-right">Price</div>
        </div>
        <div className="divide-y divide-border">
          {loading && rows.length === 0 ? (
            <div className="px-4 py-6 text-sm text-mutedForeground">Loading leads…</div>
          ) : null}
          {rows.map((s) => (
            <Link
              key={s.id}
              href={`/app/sales/${s.id}`}
              className="grid grid-cols-[120px_1fr_1.2fr_140px_100px] gap-3 px-4 py-3 hover:bg-muted/40"
            >
              <div className="text-sm text-mutedForeground">{fmtDate(s.created_at)}</div>
              <div className="min-w-0">
                <div className="truncate text-sm font-medium">{s.customer_name || s.customer_phone || '—'}</div>
                <div className="truncate text-xs text-mutedForeground">{s.customer_phone || '—'}</div>
              </div>
              <div className="truncate text-sm text-mutedForeground">{fmtAddress(s)}</div>
              <div className="truncate text-sm text-mutedForeground">{s.rep_name || s.rep_id?.slice(0, 8) + '…'}</div>
              <div className="text-right text-sm font-medium">{fmtCurrency(s.price)}</div>
            </Link>
          ))}
          {!loading && rows.length === 0 ? (
            <div className="px-4 py-8 text-sm text-mutedForeground">No leads yet. Add a lead or sync from the field.</div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
