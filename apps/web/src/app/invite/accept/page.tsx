'use client';

import { useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { api } from '../../../lib/api';
import { Button } from '../../../ui/button';
import { Input } from '../../../ui/input';

export default function InviteAcceptPage() {
  const sp = useSearchParams();
  const token = useMemo(() => sp.get('token') || '', [sp]);

  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      if (!token) throw new Error('Missing token');
      if (password.length < 8) throw new Error('Password must be at least 8 characters');
      await api.post('/v1/invites/accept', { token, name, password });
      window.location.href = '/app/dashboard';
    } catch (err: any) {
      setError(err?.message || 'Invite acceptance failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen grid place-items-center p-6">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-soft">
        <h1 className="text-2xl font-semibold">Accept invite</h1>
        <p className="mt-1 text-sm text-mutedForeground">Create your password to finish onboarding.</p>

        <form onSubmit={onSubmit} className="mt-6 space-y-3">
          <div>
            <label className="text-sm text-mutedForeground">Name</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" />
          </div>

          <div>
            <label className="text-sm text-mutedForeground">Password</label>
            <Input value={password} onChange={(e) => setPassword(e.target.value)} type="password" placeholder="••••••••" />
          </div>

          <input type="hidden" value={token} readOnly />

          {error ? <div className="text-sm text-destructive">{error}</div> : null}

          <Button disabled={loading} className="w-full">
            {loading ? 'Creating…' : 'Accept invite'}
          </Button>
        </form>

        <div className="mt-4 text-xs text-mutedForeground">
          Token is provided by your admin. If you don&apos;t have it, request a new invite.
        </div>
      </div>
    </div>
  );
}
