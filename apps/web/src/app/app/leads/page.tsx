'use client';

import * as React from 'react';
import Link from 'next/link';
import { Trash2, X } from 'lucide-react';
import { api, ApiError } from '../../../lib/api';
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
  const [deleteTarget, setDeleteTarget] = React.useState<LeadRow | null>(null);
  const [deleteError, setDeleteError] = React.useState<string | null>(null);
  const [deleting, setDeleting] = React.useState(false);

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

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    setDeleteError(null);
    setErr(null);
    try {
      await api(`/v1/sales/${deleteTarget.id}`, { method: 'DELETE' });
      setRows((prev) => prev.filter((r) => r.id !== deleteTarget.id));
      setDeleteTarget(null);
    } catch (e: any) {
      if (e instanceof ApiError && e.status === 404) {
        setRows((prev) => prev.filter((r) => r.id !== deleteTarget.id));
        setDeleteTarget(null);
      } else {
        setDeleteError(e?.message || 'Failed to delete lead');
      }
    } finally {
      setDeleting(false);
    }
  }

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
        <div className="grid grid-cols-[120px_1fr_1.2fr_140px_100px_80px] gap-3 border-b border-border px-4 py-3 text-xs font-semibold text-mutedForeground">
          <div>Date</div>
          <div>Customer</div>
          <div>Address</div>
          <div>Rep</div>
          <div className="text-right">Price</div>
          <div className="text-right">Action</div>
        </div>
        <div className="divide-y divide-border">
          {loading && rows.length === 0 ? (
            <div className="px-4 py-6 text-sm text-mutedForeground">Loading leads…</div>
          ) : null}
          {rows.map((s) => (
            <div
              key={s.id}
              className="grid grid-cols-[120px_1fr_1.2fr_140px_100px_80px] gap-3 px-4 py-3 hover:bg-muted/40 items-center"
            >
              <Link href={`/app/sales/${s.id}`} className="contents">
                <div className="text-sm text-mutedForeground">{fmtDate(s.created_at)}</div>
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium">{s.customer_name || s.customer_phone || '—'}</div>
                  <div className="truncate text-xs text-mutedForeground">{s.customer_phone || '—'}</div>
                </div>
                <div className="truncate text-sm text-mutedForeground">{fmtAddress(s)}</div>
                <div className="truncate text-sm text-mutedForeground">{s.rep_name || s.rep_id?.slice(0, 8) + '…'}</div>
                <div className="text-right text-sm font-medium">{fmtCurrency(s.price)}</div>
              </Link>
              <div className="text-right" onClick={(e) => e.stopPropagation()}>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-mutedForeground hover:text-destructive"
                  disabled={deleting && deleteTarget?.id === s.id}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setDeleteTarget(s);
                    setDeleteError(null);
                  }}
                  aria-label="Delete lead"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
          {!loading && rows.length === 0 ? (
            <div className="px-4 py-8 text-sm text-mutedForeground">No leads yet. Add a lead or sync from the field.</div>
          ) : null}
        </div>
      </div>

      {deleteTarget ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" role="dialog" aria-modal="true" aria-labelledby="delete-lead-dialog-title">
          <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-4 shadow-soft">
            <div className="flex items-start justify-between gap-2">
              <h2 id="delete-lead-dialog-title" className="text-sm font-semibold">Delete lead</h2>
              <button
                type="button"
                onClick={() => { setDeleteTarget(null); setDeleteError(null); }}
                className="rounded-lg p-1 text-mutedForeground hover:bg-muted hover:text-foreground"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <p className="mt-2 text-sm text-mutedForeground">
              This action cannot be undone. The lead for {deleteTarget.customer_name || deleteTarget.customer_phone || 'this customer'} will be permanently removed.
            </p>
            {deleteError ? <div className="mt-3 text-sm text-destructive">{deleteError}</div> : null}
            <div className="mt-6 flex justify-end gap-2">
              <Button onClick={() => { setDeleteTarget(null); setDeleteError(null); }} disabled={deleting}>
                Cancel
              </Button>
              <Button variant="ghost" onClick={confirmDelete} disabled={deleting} className="border-destructive/50 text-destructive hover:bg-destructive/10">
                {deleting ? 'Deleting…' : 'Proceed'}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
