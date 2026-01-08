'use client';

import { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { AppShell } from '../../ui/shell';
import Link from 'next/link';

export default function CountiesPage() {
  const [me, setMe] = useState<any>(null);
  const [counties, setCounties] = useState<any[]>([]);

  useEffect(() => {
    api.get('/v1/auth/me').then((r) => setMe(r.user)).catch(() => (window.location.href = '/login'));
    api.get('/v1/counties').then((r) => setCounties(r.counties || [])).catch(() => {});
  }, []);

  return (
    <AppShell active="counties" me={me}>
      <div className="p-6">
        <div className="flex items-end justify-between">
          <div>
            <h1 className="text-2xl font-semibold">Counties</h1>
            <p className="text-sm text-mutedForeground">Choose a county to view properties and cluster sets</p>
          </div>
        </div>

        <div className="mt-6 divide-y divide-border rounded-2xl border border-border bg-card shadow-soft">
          {counties.map((c) => (
            <Link key={c.id} href={`/counties/${c.id}`} className="flex items-center justify-between px-4 py-3 hover:bg-muted">
              <div>
                <div className="font-medium">{c.name}</div>
                <div className="text-xs text-mutedForeground">{c.fips || '—'}</div>
              </div>
              <div className="text-xs text-mutedForeground">Open →</div>
            </Link>
          ))}
          {counties.length === 0 ? <div className="px-4 py-4 text-sm text-mutedForeground">No counties yet.</div> : null}
        </div>
      </div>
    </AppShell>
  );
}
