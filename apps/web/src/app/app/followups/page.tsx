'use client';

import { useEffect, useState } from 'react';
import { api } from '../../../lib/api';
import { Button } from '../../../ui/button';
import { useMe } from '../../../lib/use-me';

export default function FollowupsPage() {
  const { me } = useMe();
  const [followups, setFollowups] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const res = await api.get('/v1/followups');
      setFollowups(res.followups || []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load().catch(() => {});
  }, []);

  return (
    <div className="p-6">
        <div className="flex items-end justify-between">
          <div>
            <h1 className="text-2xl font-semibold">Follow-ups</h1>
            <p className="mt-1 text-sm text-mutedForeground">Due items across your team</p>
          </div>
          <Button onClick={() => load()} disabled={loading}>
            {loading ? 'Refreshing…' : 'Refresh'}
          </Button>
        </div>

        <div className="mt-6 divide-y divide-border rounded-2xl border border-border bg-card shadow-soft">
          {loading && followups.length === 0 ? (
            <div className="px-4 py-4 text-sm text-mutedForeground">Loading follow-ups…</div>
          ) : null}
          {followups.map((f) => (
            <div key={f.id} className="px-4 py-3">
              <div className="flex items-center justify-between">
                <div className="text-sm font-medium">{f.property_id?.slice(0, 8)}…</div>
                <div className="text-xs text-mutedForeground">{new Date(f.due_at).toLocaleString()}</div>
              </div>
              <div className="mt-1 text-xs text-mutedForeground">
                rep: {f.rep_id ? f.rep_id.slice(0, 8) + '…' : '—'} • status: {f.status}
              </div>
              {f.notes ? <div className="mt-2 text-sm text-foreground/90">{f.notes}</div> : null}
            </div>
          ))}
          {!loading && followups.length === 0 ? (
            <div className="px-4 py-4 text-sm text-mutedForeground">No follow-ups due.</div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
