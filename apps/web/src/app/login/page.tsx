'use client';

import { useState } from 'react';
import { LoginSchema } from '@block/shared';
import { api } from '../../lib/api';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [turnstileToken, setTurnstileToken] = useState<string | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const payload = LoginSchema.parse({ email, password, turnstileToken });
      await api.post('/v1/auth/login', payload);
      window.location.href = '/app/dashboard';
    } catch (err: any) {
      setError(err?.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen grid place-items-center p-6">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-soft">
        <h1 className="text-2xl font-semibold">Block</h1>
        <p className="mt-1 text-sm text-mutedForeground">Sign in (admin/manager)</p>

        <form onSubmit={onSubmit} className="mt-6 space-y-3">
          <div>
            <label className="text-sm text-mutedForeground">Email</label>
            <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" />
          </div>
          <div>
            <label className="text-sm text-mutedForeground">Password</label>
            <Input value={password} onChange={(e) => setPassword(e.target.value)} type="password" placeholder="••••••••" />
          </div>

          {/* Turnstile widget can be added here; for now token is optional */}
          <input type="hidden" value={turnstileToken || ''} readOnly />

          {error ? <div className="text-sm text-destructive">{error}</div> : null}

          <Button disabled={loading} className="w-full">
            {loading ? 'Signing in…' : 'Sign in'}
          </Button>
        </form>

        <div className="mt-4 text-xs text-mutedForeground">
          Need access? Ask an admin for an invite link.
        </div>
      </div>
    </div>
  );
}
