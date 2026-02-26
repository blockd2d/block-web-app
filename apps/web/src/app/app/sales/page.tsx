'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { api } from '../../../lib/api';
import { Button } from '../../../ui/button';
import { Input } from '../../../ui/input';
import { fmtCurrency } from '../../../lib/format';
import { useMe } from '../../../lib/use-me';

type Rep = { id: string; name: string };

type SaleRow = {
  id: string;
  created_at: string;
  rep_id: string;
  rep_name?: string | null;
  pipeline_status: string;
  sale_status?: string;
  price?: number | null;
  service_type?: string | null;
  customer_name?: string | null;
  customer_phone?: string | null;
  address1?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
};

const STATUS_OPTIONS = [
  { value: '', label: 'All statuses' },
  { value: 'lead', label: 'Lead' },
  { value: 'quote', label: 'Quote' },
  { value: 'sold', label: 'Sold' },
  { value: 'job_complete', label: 'Job complete' },
  { value: 'payment_paid', label: 'Payment paid' },
  { value: 'cancelled', label: 'Cancelled' }
];

type Range = 'week' | 'month' | 'all' | 'custom';

function fmtDate(ts?: string) {
  if (!ts) return '—';
  try {
    return new Date(ts).toLocaleString();
  } catch {
    return ts;
  }
}

function fmtAddress(s: SaleRow) {
  const line = [s.address1, s.city, s.state, s.zip].filter(Boolean).join(', ');
  return line || '—';
}

export default function SalesPage() {
  const { me } = useMe();
  const role = me?.role as string | undefined;
  const canExport = role === 'admin' || role === 'manager';
  const canFilterRep = role === 'admin' || role === 'manager';

  const [reps, setReps] = useState<Rep[]>([]);
  const [rows, setRows] = useState<SaleRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);
  const [range, setRange] = useState<Range>('month');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [repId, setRepId] = useState('');
  const [status, setStatus] = useState('');
  const [q, setQ] = useState('');
  const [qDebounced, setQDebounced] = useState('');

  useEffect(() => {
    const t = setTimeout(() => setQDebounced(q), 250);
    return () => clearTimeout(t);
  }, [q]);

  async function loadReps() {
    try {
      const r = await api.get('/v1/reps?limit=500');
      setReps(r.reps || []);
    } catch {
      // ignore
    }
  }

  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    params.set('page', String(page));
    params.set('limit', String(limit));
    if (range !== 'custom') params.set('range', range);
    if (range === 'custom') {
      if (dateFrom) params.set('date_from', dateFrom);
      if (dateTo) params.set('date_to', dateTo);
    }
    if (canFilterRep && repId) params.set('rep_id', repId);
    if (status) params.set('status', status);
    if (qDebounced.trim()) params.set('q', qDebounced.trim());
    return params.toString();
  }, [page, limit, range, dateFrom, dateTo, repId, status, qDebounced, canFilterRep]);

  async function loadSales() {
    setErr(null);
    setLoading(true);
    try {
      const r = await api.get(`/v1/sales?${queryString}`);
      setRows(r.items || r.sales || []);
      setTotal(r.total || 0);
    } catch (e: any) {
      setErr(e?.message || 'Failed to load sales');
    } finally {
      setLoading(false);
    }
  }

  async function createSalesExport() {
    setErr(null);
    try {
      await api.post('/v1/exports', { type: 'sales' });
      window.location.href = '/app/exports';
    } catch (e: any) {
      setErr(e?.message || 'Failed to start export');
    }
  }

  // Load reps once for managers/admins
  useEffect(() => {
    if (!me) return;
    if (role === 'admin' || role === 'manager') {
      loadReps().catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me, role]);

  // Re-run load on filter changes
  useEffect(() => {
    loadSales().catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryString]);

  const totalPages = Math.max(1, Math.ceil(total / limit));

  return (
    <div className="p-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-2xl font-semibold">Sales</h1>
            <p className="mt-1 text-sm text-mutedForeground">Pipeline, jobs, payments, and attachments</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => loadSales()} disabled={loading}>
              {loading ? 'Refreshing…' : 'Refresh'}
            </Button>
            {canExport ? (
              <Button onClick={createSalesExport} disabled={loading}>
                Export Sales
              </Button>
            ) : null}
          </div>
        </div>

        {err ? (
          <div className="mt-4 rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructiveForeground">
            {err}
          </div>
        ) : null}

        <div className="mt-6 rounded-2xl border border-border bg-card p-4 shadow-soft">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-12">
            <div className="md:col-span-3">
              <label className="text-xs text-mutedForeground">Date range</label>
              <select
                value={range}
                onChange={(e) => {
                  setPage(1);
                  setRange(e.target.value as Range);
                }}
                className="mt-1 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring/40"
              >
                <option value="week">This week</option>
                <option value="month">This month</option>
                <option value="all">All time</option>
                <option value="custom">Custom…</option>
              </select>
            </div>

            {range === 'custom' ? (
              <>
                <div className="md:col-span-3">
                  <label className="text-xs text-mutedForeground">From</label>
                  <Input
                    type="date"
                    value={dateFrom}
                    onChange={(e) => {
                      setPage(1);
                      setDateFrom(e.target.value);
                    }}
                    className="mt-1"
                  />
                </div>
                <div className="md:col-span-3">
                  <label className="text-xs text-mutedForeground">To</label>
                  <Input
                    type="date"
                    value={dateTo}
                    onChange={(e) => {
                      setPage(1);
                      setDateTo(e.target.value);
                    }}
                    className="mt-1"
                  />
                </div>
              </>
            ) : null}

            <div className="md:col-span-3">
              <label className="text-xs text-mutedForeground">Status</label>
              <select
                value={status}
                onChange={(e) => {
                  setPage(1);
                  setStatus(e.target.value);
                }}
                className="mt-1 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring/40"
              >
                {STATUS_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>

            {canFilterRep ? (
              <div className="md:col-span-3">
                <label className="text-xs text-mutedForeground">Rep</label>
                <select
                  value={repId}
                  onChange={(e) => {
                    setPage(1);
                    setRepId(e.target.value);
                  }}
                  className="mt-1 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring/40"
                >
                  <option value="">All reps</option>
                  {reps.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}

            <div className={canFilterRep ? 'md:col-span-3' : 'md:col-span-6'}>
              <label className="text-xs text-mutedForeground">Search</label>
              <Input
                value={q}
                onChange={(e) => {
                  setPage(1);
                  setQ(e.target.value);
                }}
                placeholder="Customer name, phone, email, or address"
                className="mt-1"
              />
            </div>

            <div className="md:col-span-2">
              <label className="text-xs text-mutedForeground">Page size</label>
              <select
                value={limit}
                onChange={(e) => {
                  setPage(1);
                  setLimit(Number(e.target.value));
                }}
                className="mt-1 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring/40"
              >
                {[10, 25, 50, 100].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="mt-6 rounded-2xl border border-border bg-card shadow-soft">
          <div className="grid grid-cols-[140px_1.2fr_1.4fr_180px_140px_140px] gap-3 border-b border-border px-4 py-3 text-xs font-semibold text-mutedForeground">
            <div>Date</div>
            <div>Customer</div>
            <div>Address</div>
            <div>Rep</div>
            <div>Status</div>
            <div className="text-right">Price</div>
          </div>

          <div className="divide-y divide-border">
            {loading && rows.length === 0 ? (
              <div className="px-4 py-6 text-sm text-mutedForeground">Loading sales…</div>
            ) : null}

            {rows.map((s) => (
              <Link
                key={s.id}
                href={`/app/sales/${s.id}`}
                className="grid grid-cols-[140px_1.2fr_1.4fr_180px_140px_140px] gap-3 px-4 py-3 hover:bg-muted/40"
              >
                <div className="text-sm text-mutedForeground">{fmtDate(s.created_at)}</div>
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium">{s.customer_name || s.customer_phone || '—'}</div>
                  <div className="truncate text-xs text-mutedForeground">{s.service_type || '—'}</div>
                </div>
                <div className="truncate text-sm text-mutedForeground">{fmtAddress(s)}</div>
                <div className="truncate text-sm text-mutedForeground">{s.rep_name || s.rep_id?.slice(0, 8) + '…'}</div>
                <div className="text-sm font-medium">{String(s.pipeline_status || s.sale_status || '—')}</div>
                <div className="text-right text-sm font-medium">{fmtCurrency(s.price)}</div>
              </Link>
            ))}

            {!loading && rows.length === 0 ? (
              <div className="px-4 py-8 text-sm text-mutedForeground">No sales match these filters.</div>
            ) : null}
          </div>
        </div>

        <div className="mt-4 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div className="text-sm text-mutedForeground">
            {total} total • page {page} of {totalPages}
          </div>
          <div className="flex gap-2">
            <Button
              variant="secondary"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1 || loading}
            >
              Prev
            </Button>
            <Button
              variant="secondary"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages || loading}
            >
              Next
            </Button>
          </div>
        </div>
      </div>
  );
}
