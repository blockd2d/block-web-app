'use client';

import { useEffect, useState } from 'react';
import { api } from '../../../lib/api';
import { Button } from '../../../ui/button';
import { Input } from '../../../ui/input';
import { useMe } from '../../../lib/use-me';

export default function SettingsPage() {
  const { me } = useMe();
  const [invites, setInvites] = useState<any[]>([]);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'manager' | 'admin'>('manager');
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function loadInvites() {
    const res = await api.get('/v1/invites');
    setInvites(res.invites || []);
  }

  async function createInvite() {
    setErr(null);
    setLoading(true);
    try {
      const res = await api.post('/v1/invites', { email, role });
      setInvites([res.invite, ...invites]);
      setEmail('');
    } catch (e: any) {
      setErr(e?.message || 'Failed');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadInvites().catch(() => {});
  }, []);

  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold">Settings</h1>
      <p className="mt-1 text-sm text-mutedForeground">Org users and invites (invite-only onboarding)</p>

      {me?.role !== 'admin' ? (
        <div className="mt-6 rounded-2xl border border-border bg-card p-4 text-sm text-mutedForeground shadow-soft">
          You must be an admin to manage organization settings and invites.
        </div>
      ) : (
        <>
          <div className="mt-6 rounded-2xl border border-border bg-card p-4 shadow-soft">
          <div className="text-sm font-semibold">Create invite</div>
          <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
            <div className="md:col-span-2">
                <label className="text-xs text-mutedForeground">Email</label>
              <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="manager@company.com" />
            </div>
            <div>
                <label className="text-xs text-mutedForeground">Role</label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as any)}
                  className="mt-1 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-mutedForeground focus:outline-none focus:ring-2 focus:ring-ring/40"
              >
                <option value="manager">Manager</option>
                <option value="admin">Admin</option>
              </select>
            </div>
          </div>
            {err ? <div className="mt-3 text-sm text-destructive">{err}</div> : null}
          <div className="mt-3">
            <Button disabled={loading || !email} onClick={createInvite}>
              {loading ? 'Creating…' : 'Create invite'}
            </Button>
          </div>
        </div>

        <div className="mt-6 rounded-2xl border border-border bg-card shadow-soft">
          <div className="px-4 py-3 font-semibold">Invites</div>
            <div className="divide-y divide-border">
            {invites.map((i) => (
              <div key={i.id} className="px-4 py-3">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-medium">{i.email}</div>
                    <div className="text-xs text-mutedForeground">{i.role}</div>
                </div>
                  <div className="mt-1 text-xs text-mutedForeground">
                  {i.accepted_at ? `accepted ${new Date(i.accepted_at).toLocaleString()}` : `expires ${new Date(i.expires_at).toLocaleString()}`}
                </div>
                {!i.accepted_at ? (
                    <div className="mt-2 text-xs text-mutedForeground">
                    Invite link: <span className="select-all">/invite/accept?token={i.token}</span>
                  </div>
                ) : null}
              </div>
            ))}
              {invites.length === 0 ? <div className="px-4 py-4 text-sm text-mutedForeground">No invites.</div> : null}
          </div>
        </div>
        </>
      )}
    </div>
  );
}
