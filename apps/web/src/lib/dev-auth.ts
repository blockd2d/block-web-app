/**
 * Dev-only auth: login without calling the API.
 * Must match API DEV_ACCOUNT (email/password) and Me shape.
 */

export const DEV_AUTH_STORAGE_KEY = 'block_dev_me';

/** Dev user shape for MeProvider (matches API /me for dev account). */
export const DEV_ME = {
  id: '00000000-0000-4000-8000-000000000001',
  email: 'stephenonochie@gmail.com',
  name: 'Dev User',
  role: 'admin' as const,
  org_name: 'Dev Org'
};

/** Credentials for dev-only login (no API). */
export const DEV_CREDENTIALS = {
  email: 'stephenonochie@gmail.com',
  password: 'BlockDev2025!'
};

export function isDevLogin(email: string, password: string): boolean {
  const e = (email ?? '').trim().toLowerCase();
  const p = (password ?? '').trim();
  return e === DEV_CREDENTIALS.email.toLowerCase() && p === DEV_CREDENTIALS.password;
}

export function setDevSession(): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(DEV_AUTH_STORAGE_KEY, JSON.stringify(DEV_ME));
  // Allow /app middleware to detect dev session
  document.cookie = 'block_dev=1; path=/; samesite=lax';
}

export function clearDevSession(): void {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(DEV_AUTH_STORAGE_KEY);
  document.cookie = 'block_dev=; path=/; max-age=0; samesite=lax';
}

export function getDevMe(): typeof DEV_ME | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(DEV_AUTH_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (parsed && typeof parsed === 'object' && 'id' in parsed && typeof (parsed as any).id === 'string') {
      return parsed as typeof DEV_ME;
    }
    return null;
  } catch {
    return null;
  }
}
