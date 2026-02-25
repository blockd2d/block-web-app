'use client';

import * as React from 'react';
import { api } from '../../../lib/api';
import { Button } from '../../../ui/button';

type Laborer = {
  id: string;
  name: string;
  active: boolean;
  created_at?: string;
};

export default function CrewsPage() {
  const [laborers, setLaborers] = React.useState<Laborer[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [err, setErr] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    setErr(null);
    setLoading(true);
    try {
      const r = await api.get('/v1/labor/laborers');
      setLaborers((r.laborers || []) as Laborer[]);
    } catch (e: any) {
      setErr(e?.message || 'Failed to load crew');
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold">Crews</h1>
      <p className="mt-1 text-sm text-mutedForeground">Labor crew members (for job assignment and scheduling).</p>

      {err ? (
        <div className="mt-4 rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructiveForeground">
          {err}
        </div>
      ) : null}

      <div className="mt-6 rounded-2xl border border-border bg-card shadow-soft">
        <div className="flex items-center justify-between border-b border-border p-4">
          <div className="text-sm font-semibold">Laborers</div>
          <Button variant="ghost" onClick={() => load()} disabled={loading}>
            {loading ? 'Refreshing…' : 'Refresh'}
          </Button>
        </div>
        <div className="divide-y divide-border">
          {loading && laborers.length === 0 ? (
            <div className="px-4 py-6 text-sm text-mutedForeground">Loading…</div>
          ) : laborers.length ? (
            laborers.map((l) => (
              <div key={l.id} className="flex items-center justify-between gap-3 px-4 py-3">
                <div>
                  <div className="font-medium">{l.name}</div>
                  <div className="text-xs text-mutedForeground">{l.id.slice(0, 8)}… • {l.active ? 'Active' : 'Inactive'}</div>
                </div>
              </div>
            ))
          ) : (
            <div className="px-4 py-8 text-sm text-mutedForeground">No laborers yet. Add crew members via your backend or invite flow.</div>
          )}
        </div>
      </div>
    </div>
  );
}
