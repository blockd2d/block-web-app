'use client';

import { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { AppShell } from '../../ui/shell';

export default function LaborPage() {
  const [me, setMe] = useState<any>(null);
  const [jobs, setJobs] = useState<any[]>([]);

  useEffect(() => {
    api.get('/v1/auth/me').then((r) => setMe(r.user)).catch(() => (window.location.href = '/login'));
    api.get('/v1/labor/jobs').then((r) => setJobs(r.jobs || [])).catch(() => {});
  }, []);

  return (
    <AppShell active="labor" me={me}>
      <div className="p-6">
        <h1 className="text-2xl font-semibold">Labor</h1>
        <p className="text-sm text-mutedForeground">Jobs scheduling and status</p>

        <div className="mt-6 overflow-auto rounded-2xl border border-border bg-card shadow-soft">
          <table className="w-full text-left text-sm">
            <thead className="text-xs text-mutedForeground">
              <tr className="border-b border-border">
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Scheduled</th>
                <th className="px-4 py-3">Laborer</th>
                <th className="px-4 py-3">Sale</th>
              </tr>
            </thead>
            <tbody>
              {jobs.map((j) => (
                <tr key={j.id} className="border-b border-border/60">
                  <td className="px-4 py-3">{j.status}</td>
                  <td className="px-4 py-3 text-foreground/90">
                    {j.scheduled_start ? new Date(j.scheduled_start).toLocaleString() : '—'}
                  </td>
                  <td className="px-4 py-3 text-xs text-mutedForeground">
                    {j.laborer_id ? String(j.laborer_id).slice(0, 8) + '…' : '—'}
                  </td>
                  <td className="px-4 py-3 text-xs text-mutedForeground">{String(j.sale_id).slice(0, 8)}…</td>
                </tr>
              ))}
              {jobs.length === 0 ? (
                <tr>
                  <td className="px-4 py-6 text-mutedForeground" colSpan={4}>
                    No jobs yet.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </AppShell>
  );
}
