'use client';

import { useEffect, useMemo, useState } from 'react';
import { api } from '../../../lib/api';
import { AppShell } from '../../../ui/shell';
import { Button } from '../../../ui/button';

function fmt(ts?: string) {
  if (!ts) return '—';
  try {
    return new Date(ts).toLocaleString();
  } catch {
    return ts;
  }
}

export default function ExportsPage() {
  const [me, setMe] = useState<any>(null);
  const [exportsList, setExportsList] = useState<any[]>([]);
  const [creating, setCreating] = useState<'sales' | 'assignments' | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const r = await api.get('/v1/exports');
    setExportsList(r.exports || []);
  }

  useEffect(() => {
    api
      .get('/v1/auth/me')
      .then((r) => setMe(r.user))
      .catch(() => (window.location.href = '/login'));
    load().catch(() => {});
  }, []);

  const hasActive = useMemo(
    () => exportsList.some((e) => e.status === 'queued' || e.status === 'running'),
    [exportsList]
  );

  useEffect(() => {
    if (!hasActive) return;
    const t = setInterval(() => load().catch(() => {}), 4000);
    return () => clearInterval(t);
  }, [hasActive]);

  async function create(type: 'sales' | 'assignments') {
    setError(null);
    setCreating(type);
    try {
      await api.post('/v1/exports', { type });
      await load();
    } catch (e: any) {
      setError(e?.message || 'Export failed');
    } finally {
      setCreating(null);
    }
  }

  async function download(id: string) {
    setError(null);
    try {
      const r = await api.get(`/v1/exports/${id}/download`);
      if (r?.url) window.open(r.url, '_blank', 'noopener,noreferrer');
    } catch (e: any) {
      setError(e?.message || 'Download failed');
    }
  }

  return (
    <AppShell active="exports" me={me}>
      <div className="p-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-2xl font-semibold">Exports</h1>
            <p className="text-sm text-mutedForeground">
              Large exports run as background jobs. Downloads are signed links (10 minutes).
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button onClick={() => create('sales')} disabled={creating !== null}>
              {creating === 'sales' ? 'Starting…' : 'Export Sales'}
            </Button>
            <Button onClick={() => create('assignments')} disabled={creating !== null}>
              {creating === 'assignments' ? 'Starting…' : 'Export Assignments'}
            </Button>
          </div>
        </div>

        {error ? (
          <div className="mt-4 rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructiveForeground">
            {error}
          </div>
        ) : null}

        <div className="mt-6 rounded-2xl border border-border bg-card shadow-soft">
          <div className="grid grid-cols-[160px_120px_1fr_160px] gap-3 border-b border-border px-4 py-3 text-xs font-semibold text-mutedForeground">
            <div>Type</div>
            <div>Status</div>
            <div>Created</div>
            <div className="text-right">Action</div>
          </div>

          <div className="divide-y divide-border">
            {exportsList.map((e) => (
              <div key={e.id} className="grid grid-cols-[160px_120px_1fr_160px] gap-3 px-4 py-3">
                <div className="text-sm font-medium">{e.type}</div>
                <div className="text-sm text-foreground/90">{e.status}</div>
                <div className="text-sm text-mutedForeground">{fmt(e.created_at)}</div>
                <div className="flex justify-end">
                  {e.status === 'complete' ? (
                    <Button variant="secondary" size="sm" onClick={() => download(e.id)}>
                      Download
                    </Button>
                  ) : (
                    <div className="text-sm text-mutedForeground">—</div>
                  )}
                </div>
              </div>
            ))}

            {exportsList.length === 0 ? (
              <div className="px-4 py-6 text-sm text-mutedForeground">No exports yet.</div>
            ) : null}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
