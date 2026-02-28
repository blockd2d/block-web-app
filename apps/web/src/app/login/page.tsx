'use client';

import Link from 'next/link';
import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { LoginSchema } from '@blockd2d/shared';
import { api, ApiError } from '../../lib/api';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';

function LoginForm() {
  const searchParams = useSearchParams();

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
      const next = searchParams.get('next');
      const dest = next && next.startsWith('/app') ? next : '/app/dashboard';
      window.location.href = dest;
    } catch (err: any) {
      if (err instanceof ApiError && err.status === 404) {
        setError(
          'Login request failed (404). Check that the API is running and NEXT_PUBLIC_API_URL points to the Block API (e.g. http://localhost:4000).'
        );
      } else if (err instanceof ApiError && err.status === 401) {
        setError('Invalid credentials.');
      } else {
        setError(err?.message || 'Login failed');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen grid place-items-center p-6">
      <div className="flex w-full max-w-md flex-col items-center gap-4">
        <div className="w-full max-w-md text-left">
          <Link href="/" className="text-sm text-mutedForeground hover:text-foreground">
            ← Back
          </Link>
        </div>
        <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-soft">
        <div className="flex items-center gap-3">
          <img src="/block-logo-icon.png" alt="Block" className="h-10 w-10 shrink-0 object-contain" />
          <div>
            <h1 className="text-2xl font-semibold">Block</h1>
            <p className="mt-0.5 text-sm text-mutedForeground">Sign in (admin/manager)</p>
          </div>
        </div>

        <form onSubmit={onSubmit} className="mt-6 space-y-3">
          <div>
            <label className="text-sm text-mutedForeground" htmlFor="email">
              Email
            </label>
            <Input
              id="email"
              autoComplete="email"
              autoFocus
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
            />
          </div>
          <div>
            <label className="text-sm text-mutedForeground" htmlFor="password">
              Password
            </label>
            <Input
              id="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type="password"
              placeholder="••••••••"
            />
          </div>

          {/* Turnstile widget can be added here; for now token is optional */}
          <input type="hidden" value={turnstileToken || ''} readOnly />

          {error ? <div className="text-sm text-destructive">{error}</div> : null}

          <Button disabled={loading} className="w-full">
            {loading ? 'Signing in…' : 'Sign in'}
          </Button>
        </form>

        <div className="mt-3">
          <Link href="/join" className="text-sm text-mutedForeground hover:text-foreground">
            Join
          </Link>
        </div>

        <div className="mt-4 text-xs text-mutedForeground">
          Need access? Ask an admin for an invite link.
        </div>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen grid place-items-center p-6"><div className="text-sm text-mutedForeground">Loading…</div></div>}>
      <LoginForm />
    </Suspense>
  );
}
