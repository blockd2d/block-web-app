import AsyncStorage from '@react-native-async-storage/async-storage';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const Config = require('react-native-config');

const API_URL: string = Config.BLOCK_API_URL || 'http://localhost:4000';

const SESSION_KEY = '@block/session';

export type MobileSession = {
  access_token: string;
  refresh_token: string;
  expires_in?: number;
  created_at?: number;
};

export type MeUser = {
  id: string;
  org_id: string;
  role: 'admin' | 'manager' | 'rep' | 'labor';
  name: string | null;
  email: string;
};

async function readSession(): Promise<MobileSession | null> {
  const raw = await AsyncStorage.getItem(SESSION_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as MobileSession;
  } catch {
    return null;
  }
}

async function writeSession(s: MobileSession | null) {
  if (!s) {
    await AsyncStorage.removeItem(SESSION_KEY);
    return;
  }
  await AsyncStorage.setItem(SESSION_KEY, JSON.stringify(s));
}

async function request(method: string, path: string, body?: any) {
  const session = await readSession();

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'x-block-client': 'mobile'
  };

  if (session?.access_token) headers.Authorization = `Bearer ${session.access_token}`;

  const res = await fetch(API_URL + path, {
    method,
    headers,
    body: body != null ? JSON.stringify(body) : undefined
  });

  const ct = res.headers.get('content-type') || '';
  const data = ct.includes('application/json') ? await res.json() : await res.text();

  if (res.ok) return data;

  // If unauthorized, attempt one refresh then retry once.
  if (res.status === 401 && session?.refresh_token) {
    try {
      const refreshed = await fetch(API_URL + '/v1/auth/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-block-client': 'mobile' },
        body: JSON.stringify({ refresh_token: session.refresh_token })
      });
      const rct = refreshed.headers.get('content-type') || '';
      const rdata = rct.includes('application/json') ? await refreshed.json() : await refreshed.text();
      if (refreshed.ok && rdata?.session?.access_token) {
        await writeSession({ ...rdata.session, created_at: Date.now() });
        return await request(method, path, body);
      }
    } catch {
      // ignore
    }
  }

  throw new Error((data && (data.error || data.message)) || 'Request failed');
}

export const blockApi = {
  apiUrl: API_URL,

  getSession: readSession,
  setSession: writeSession,

  async login(email: string, password: string) {
    const res = await request('POST', '/v1/auth/login', { email, password, turnstileToken: null });
    if (!res?.session?.access_token) throw new Error('Missing session');
    await writeSession({ ...res.session, created_at: Date.now() });
    return res.user as MeUser;
  },

  async logout() {
    await writeSession(null);
  },

  async me(): Promise<MeUser> {
    const res = await request('GET', '/v1/auth/me');
    return res.user as MeUser;
  },

  get: (path: string) => request('GET', path),
  post: (path: string, body: any) => request('POST', path, body)
};
