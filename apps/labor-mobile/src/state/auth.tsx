import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { Appearance } from 'react-native';
import { api, hasSession } from '../api';
import { capture, identify, reset } from '../analytics/posthog';

type AuthStatus = 'loading' | 'authed' | 'unauth';

type AuthCtx = {
  status: AuthStatus;
  profile: any | null;
  org: any | null;
  themeMode: 'dark' | 'light';
  setThemeMode: (m: 'dark' | 'light') => void;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshMe: () => Promise<void>;
};

const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [profile, setProfile] = useState<any | null>(null);
  const [org, setOrg] = useState<any | null>(null);
  const system = Appearance.getColorScheme();
  const [themeMode, setThemeMode] = useState<'dark' | 'light'>(system === 'dark' ? 'dark' : 'light');

  const refreshMe = async () => {
    const res = await api.me();
    setProfile(res?.profile ?? null);
    setOrg(res?.org ?? null);

    // PostHog: identify the worker when available
    const distinctId = res?.profile?.id || res?.profile?.email;
    if (distinctId) {
      identify(String(distinctId), {
        role: 'labor',
        orgId: res?.org?.id,
        orgName: res?.org?.name
      });
    }
  };

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const ok = await hasSession();
        if (!mounted) return;
        if (!ok) {
          setStatus('unauth');
          return;
        }
        await refreshMe();
        if (!mounted) return;
        setStatus('authed');
      } catch {
        try {
          await api.logout();
        } catch {
          // ignore
        }
        if (!mounted) return;
        setStatus('unauth');
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const login = async (email: string, password: string) => {
    setStatus('loading');
    await api.login(email, password);
    await refreshMe();
    capture('labor_login', { email });
    setStatus('authed');
  };

  const logout = async () => {
    setStatus('loading');
    await api.logout();
    setProfile(null);
    setOrg(null);
    capture('labor_logout');
    reset();
    setStatus('unauth');
  };

  const value = useMemo<AuthCtx>(
    () => ({ status, profile, org, themeMode, setThemeMode, login, logout, refreshMe }),
    [status, profile, org, themeMode]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useAuth must be used within AuthProvider');
  return v;
}
