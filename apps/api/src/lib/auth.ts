import crypto from 'node:crypto';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { env } from './env.js';
import { createAnonClient, createServiceClient } from './supabase.js';

export type Role = 'admin' | 'manager' | 'rep' | 'labor';

export type AuthContext = {
  user_id: string;
  org_id: string;
  role: Role;
  email: string;
  profile_id: string;
};

export function getAccessTokenFromRequest(req: FastifyRequest): string | null {
  const auth = req.headers['authorization'];
  if (typeof auth === 'string' && auth.startsWith('Bearer ')) return auth.slice('Bearer '.length);
  //fastify-cookie
  const c = req.cookies?.[env.SESSION_COOKIE_NAME];
  return typeof c === 'string' && c.length > 0 ? c : null;
}

export function isBearerRequest(req: FastifyRequest): boolean {
  const auth = req.headers['authorization'];
  return typeof auth === 'string' && auth.startsWith('Bearer ');
}

export async function buildAuthContext(req: FastifyRequest): Promise<AuthContext | null> {
  const accessToken = getAccessTokenFromRequest(req);
  if (!accessToken) return null;

  const supabaseAnon = createAnonClient();
  const { data, error } = await supabaseAnon.auth.getUser(accessToken);
  if (error || !data.user) return null;

  const service = createServiceClient();
  const { data: profile, error: pErr } = await service
    .from('profiles')
    .select('id, org_id, role, email')
    .eq('id', data.user.id)
    .single();

  if (pErr || !profile) return null;

  return {
    user_id: data.user.id,
    profile_id: profile.id,
    org_id: profile.org_id,
    role: profile.role,
    email: profile.email
  };
}

export function requireRole(ctx: AuthContext, allowed: Role[]) {
  if (!allowed.includes(ctx.role)) {
    const err: any = new Error('Forbidden');
    err.statusCode = 403;
    throw err;
  }
}

export function setAuthCookies(reply: FastifyReply, session: { access_token: string; refresh_token: string }) {
  const opts = {
    httpOnly: true,
    secure: env.COOKIE_SECURE,
    sameSite: 'lax' as const,
    path: '/',
    domain: env.COOKIE_DOMAIN === 'localhost' ? undefined : env.COOKIE_DOMAIN
  };

  reply.setCookie(env.SESSION_COOKIE_NAME, session.access_token, { ...opts, maxAge: 60 * 60 });
  reply.setCookie(env.REFRESH_COOKIE_NAME, session.refresh_token, { ...opts, maxAge: 60 * 60 * 24 * 30 });

  const csrf = crypto.randomUUID();
  reply.setCookie(env.CSRF_COOKIE_NAME, csrf, {
    httpOnly: false,
    secure: env.COOKIE_SECURE,
    sameSite: 'lax',
    path: '/',
    domain: env.COOKIE_DOMAIN === 'localhost' ? undefined : env.COOKIE_DOMAIN,
    maxAge: 60 * 60 * 24 * 7
  });
  return csrf;
}

export function clearAuthCookies(reply: FastifyReply) {
  const opts = {
    httpOnly: true,
    secure: env.COOKIE_SECURE,
    sameSite: 'lax' as const,
    path: '/',
    domain: env.COOKIE_DOMAIN === 'localhost' ? undefined : env.COOKIE_DOMAIN
  };
  reply.clearCookie(env.SESSION_COOKIE_NAME, opts);
  reply.clearCookie(env.REFRESH_COOKIE_NAME, opts);
  reply.clearCookie(env.CSRF_COOKIE_NAME, { ...opts, httpOnly: false });
}

export function requireCsrf(req: FastifyRequest) {
  if (isBearerRequest(req)) return; // bearer requests are not CSRF vulnerable
  const header = req.headers['x-csrf'];
  // fastify-cookie
  const cookie = req.cookies?.[env.CSRF_COOKIE_NAME];
  if (!cookie || !header || cookie !== header) {
    const err: any = new Error('CSRF token missing or invalid');
    err.statusCode = 403;
    throw err;
  }
}

export async function refreshSession(refreshToken: string) {
  const supabaseAnon = createAnonClient();
  const { data, error } = await supabaseAnon.auth.refreshSession({ refresh_token: refreshToken });
  if (error || !data.session) {
    const err: any = new Error('Refresh failed');
    err.statusCode = 401;
    throw err;
  }
  return data.session;
}
