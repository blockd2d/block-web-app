'use client';

import { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { AppShell } from '../../ui/shell';

export default function AuditPage() {
  const [me, setMe] = useState<any>(null);
  const [audit, setAudit] = useState<any[]>([]);

  useEffect(() => {
    api.get('/v1/auth/me').then((r) => setMe(r.user)).catch(() => (window.location.href = '/login'));
    api.get('/v1/audit?limit=150').then((r) => setAudit(r.audit || [])).catch(() => {});
  }, []);

  return (
    <AppShell active="audit" me={me}>
      <div className="p-6">
        <h1 className="text-2xl font-semibold">Audit Log</h1>
        <p className="text-sm text-mutedForeground">Admin/manager actions</p>

        <div className="mt-6 space-y-2">
          {audit.map((a) => (
            <div key={a.id} className="rounded-xl border border-border bg-card p-3 shadow-soft">
              <div className="flex items-center justify-between">
                <div className="text-sm font-medium">{a.action}</div>
                <div className="text-xs text-mutedForeground">{new Date(a.created_at).toLocaleString()}</div>
              </div>
              <div className="mt-1 text-xs text-mutedForeground">
                entity: {a.entity_type || '—'} {a.entity_id ? String(a.entity_id).slice(0, 8) + '…' : ''}
              </div>
            </div>
          ))}
          {audit.length === 0 ? <div className="text-sm text-mutedForeground">No audit events yet.</div> : null}
        </div>
      </div>
    </AppShell>
  );
}
