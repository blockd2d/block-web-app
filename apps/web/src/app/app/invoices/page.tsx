'use client';

import * as React from 'react';
import Link from 'next/link';
import { api } from '../../../lib/api';
import { fmtCurrency } from '../../../lib/format';

type SaleRow = {
  id: string;
  pipeline_status: string;
  payment_status?: string | null;
  price?: number | null;
  customer_name?: string | null;
  address1?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
  created_at: string;
};

function fmtDate(ts?: string) {
  if (!ts) return '—';
  try {
    return new Date(ts).toLocaleDateString();
  } catch {
    return ts;
  }
}

function fmtAddress(s: SaleRow) {
  const line = [s.address1, s.city, s.state, s.zip].filter(Boolean).join(', ');
  return line || '—';
}

export default function InvoicesPage() {
  const [rows, setRows] = React.useState<SaleRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [err, setErr] = React.useState<string | null>(null);

  React.useEffect(() => {
    api
      .get('/v1/sales?limit=200')
      .then((r: any) => setRows((r.items || r.sales || []) as SaleRow[]))
      .catch((e: any) => setErr(e?.message || 'Failed to load'))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold">Invoices</h1>
      <p className="mt-1 text-sm text-mutedForeground">Sales and payment status. PDF invoices and customer portal links when configured.</p>

      {err ? (
        <div className="mt-4 rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructiveForeground">
          {err}
        </div>
      ) : null}

      <div className="mt-6 rounded-2xl border border-border bg-card shadow-soft">
        <div className="grid grid-cols-[100px_1fr_1.2fr_100px_100px] gap-3 border-b border-border px-4 py-3 text-xs font-semibold text-mutedForeground">
          <div>Date</div>
          <div>Customer</div>
          <div>Address</div>
          <div>Status</div>
          <div className="text-right">Amount</div>
        </div>
        <div className="divide-y divide-border">
          {loading && rows.length === 0 ? (
            <div className="px-4 py-6 text-sm text-mutedForeground">Loading…</div>
          ) : (
            rows.map((s) => (
              <Link
                key={s.id}
                href={`/app/sales/${s.id}`}
                className="grid grid-cols-[100px_1fr_1.2fr_100px_100px] gap-3 px-4 py-3 hover:bg-muted/40"
              >
                <div className="text-sm text-mutedForeground">{fmtDate(s.created_at)}</div>
                <div className="truncate text-sm font-medium">{s.customer_name || '—'}</div>
                <div className="truncate text-sm text-mutedForeground">{fmtAddress(s)}</div>
                <div className="text-sm">{s.payment_status || s.pipeline_status || '—'}</div>
                <div className="text-right text-sm font-medium">{fmtCurrency(s.price)}</div>
              </Link>
            ))
          )}
          {!loading && rows.length === 0 ? (
            <div className="px-4 py-8 text-sm text-mutedForeground">No sales yet.</div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
