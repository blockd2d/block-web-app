'use client';

import * as React from 'react';
import { api, ApiError } from '../lib/api';

export type Me = {
  id: string;
  email?: string | null;
  name?: string | null;
  role?: 'admin' | 'manager' | 'rep' | 'labor' | (string & {});
};

type MeState = {
  me: Me | null;
  loading: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
};

const MeContext = React.createContext<MeState | null>(null);

function isAuthError(err: unknown) {
  if (!err) return false;
  if (err instanceof ApiError) return err.status === 401 || err.status === 403;
  const msg = (err as any)?.message ? String((err as any).message) : '';
  return /unauth|forbidden|not\s*authorized/i.test(msg);
}

export function MeProvider({ children }: { children: React.ReactNode }) {
  const [me, setMe] = React.useState<Me | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<Error | null>(null);

  const refresh = React.useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const r = await api.get('/v1/auth/me');
      const user = (r?.user || r?.me || r) as Me | null;
      setMe(user || null);
      setError(null);
    } catch (e: any) {
      if (isAuthError(e)) {
        setMe(null);
        setError(e instanceof Error ? e : new Error('Unauthorized'));
      } else {
        setMe(null);
        setError(e instanceof Error ? e : new Error('Failed to load user'));
      }
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    refresh().catch(() => {});
  }, [refresh]);

  const value = React.useMemo<MeState>(() => ({ me, loading, error, refresh }), [me, loading, error, refresh]);

  return <MeContext.Provider value={value}>{children}</MeContext.Provider>;
}

export function useMeContext() {
  const ctx = React.useContext(MeContext);
  if (!ctx) throw new Error('useMe must be used within <MeProvider>');
  return ctx;
}

