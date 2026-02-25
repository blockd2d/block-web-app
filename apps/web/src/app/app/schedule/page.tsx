'use client';

import * as React from 'react';
import Link from 'next/link';
import { api } from '../../../lib/api';
import { useMe } from '../../../lib/use-me';

type Job = {
  id: string;
  sale_id: string;
  laborer_id: string | null;
  scheduled_start: string | null;
  scheduled_end: string | null;
  status: string;
  created_at: string;
};

export default function SchedulePage() {
  const { me } = useMe();
  const [jobs, setJobs] = React.useState<Job[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [err, setErr] = React.useState<string | null>(null);
  const isLabor = me?.role === 'labor';

  const load = React.useCallback(async () => {
    setErr(null);
    setLoading(true);
    try {
      const endpoint = isLabor ? '/v1/labor/jobs' : '/v1/jobs';
      const r = await api.get(endpoint);
      setJobs((r.jobs || r.items || []) as Job[]);
    } catch (e: any) {
      setErr(e?.message || 'Failed to load schedule');
    } finally {
      setLoading(false);
    }
  }, [isLabor]);

  React.useEffect(() => {
    load();
  }, [load]);

  function fmt(ts: string | null) {
    if (!ts) return '—';
    try {
      return new Date(ts).toLocaleString();
    } catch {
      return ts;
    }
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold">Schedule</h1>
      <p className="mt-1 text-sm text-mutedForeground">
        {isLabor ? 'Your assigned jobs.' : 'Jobs and appointments by rep/labor.'}
      </p>

      {err ? (
        <div className="mt-4 rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructiveForeground">
          {err}
        </div>
      ) : null}

      <div className="mt-6 rounded-2xl border border-border bg-card shadow-soft">
        <div className="grid grid-cols-[140px_140px_1fr_100px] gap-3 border-b border-border px-4 py-3 text-xs font-semibold text-mutedForeground">
          <div>Scheduled start</div>
          <div>Scheduled end</div>
          <div>Sale / Job</div>
          <div>Status</div>
        </div>
        <div className="divide-y divide-border">
          {loading && jobs.length === 0 ? (
            <div className="px-4 py-6 text-sm text-mutedForeground">Loading…</div>
          ) : (
            jobs.map((j) => (
              <div
                key={j.id}
                className="grid grid-cols-[140px_140px_1fr_100px] gap-3 px-4 py-3"
              >
                <div className="text-sm text-mutedForeground">{fmt(j.scheduled_start)}</div>
                <div className="text-sm text-mutedForeground">{fmt(j.scheduled_end)}</div>
                <div className="min-w-0">
                  <Link href={`/app/sales/${j.sale_id}`} className="text-sm font-medium text-primary hover:underline">
                    Sale {j.sale_id.slice(0, 8)}…
                  </Link>
                  <span className="ml-2 text-xs text-mutedForeground">Job {j.id.slice(0, 8)}…</span>
                </div>
                <div className="text-sm font-medium">{j.status}</div>
              </div>
            ))
          )}
          {!loading && jobs.length === 0 ? (
            <div className="px-4 py-8 text-sm text-mutedForeground">No scheduled jobs.</div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
