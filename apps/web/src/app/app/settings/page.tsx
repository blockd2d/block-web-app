'use client';

import { useEffect, useState } from 'react';
import { Trash2 } from 'lucide-react';
import { api } from '../../../lib/api';
import { Button } from '../../../ui/button';
import { Input } from '../../../ui/input';
import { useMe } from '../../../lib/use-me';

export default function SettingsPage() {
  const { me } = useMe();
  const [invites, setInvites] = useState<any[]>([]);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'admin' | 'manager' | 'rep' | 'labor'>('manager');
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [members, setMembers] = useState<{ id: string; role: string; name: string; email: string; created_at?: string }[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);

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

  async function deleteInvite(inviteId: string) {
    if (!confirm('Delete this invite? The link will no longer work.')) return;
    setErr(null);
    setDeletingId(inviteId);
    try {
      await api.del(`/v1/invites/${inviteId}`);
      setInvites((prev) => prev.filter((i) => i.id !== inviteId));
    } catch (e: any) {
      setErr(e?.message || 'Failed to delete invite');
    } finally {
      setDeletingId(null);
    }
  }

  async function loadMembers() {
    setMembersLoading(true);
    try {
      const res = await api.get('/v1/org/members');
      setMembers(res.members || []);
    } catch {
      setMembers([]);
    } finally {
      setMembersLoading(false);
    }
  }

  useEffect(() => {
    loadInvites().catch(() => {});
  }, []);

  useEffect(() => {
    if (me?.role === 'admin') loadMembers();
  }, [me?.role]);

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
                onChange={(e) => setRole(e.target.value as typeof role)}
                className="mt-1 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-mutedForeground focus:outline-none focus:ring-2 focus:ring-ring/40"
              >
                <option value="admin">Admin</option>
                <option value="manager">Manager</option>
                <option value="rep">Rep</option>
                <option value="labor">Laborer</option>
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
              <div key={i.id} className="flex items-start justify-between gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{i.email}</span>
                    <span className="text-xs text-mutedForeground">{i.role}</span>
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
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-mutedForeground hover:text-destructive shrink-0"
                  disabled={deletingId === i.id}
                  onClick={() => deleteInvite(i.id)}
                  aria-label="Delete invite"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
              {invites.length === 0 ? <div className="px-4 py-4 text-sm text-mutedForeground">No invites.</div> : null}
          </div>
        </div>

        <div className="mt-6 rounded-2xl border border-border bg-card shadow-soft">
          <div className="px-4 py-3 font-semibold">Organization accounts</div>
          <p className="px-4 pb-3 text-xs text-mutedForeground">All users in your organization (admins, managers, reps, laborers).</p>
          {membersLoading ? (
            <div className="px-4 py-6 text-sm text-mutedForeground">Loading…</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs font-semibold text-mutedForeground">
                    <th className="px-4 py-3">Role</th>
                    <th className="px-4 py-3">Name</th>
                    <th className="px-4 py-3">Email</th>
                    <th className="px-4 py-3">Joined</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {members.map((m) => (
                    <tr key={m.id}>
                      <td className="px-4 py-3 capitalize">{m.role}</td>
                      <td className="px-4 py-3 font-medium">{m.name || '—'}</td>
                      <td className="px-4 py-3 text-mutedForeground">{m.email}</td>
                      <td className="px-4 py-3 text-mutedForeground">
                        {m.created_at ? new Date(m.created_at).toLocaleDateString() : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {!membersLoading && members.length === 0 ? (
            <div className="px-4 py-6 text-sm text-mutedForeground">No accounts yet.</div>
          ) : null}
        </div>
        </>
      )}
    </div>
  );
}
