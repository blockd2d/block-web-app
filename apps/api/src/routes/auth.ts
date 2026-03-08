import type { FastifyInstance } from 'fastify';
import { LoginSchema } from '@blockd2d/shared';
import { createAnonClient, createServiceClient } from '../lib/supabase.js';
import { clearAuthCookies, DEV_ACCOUNT, refreshSession, setAuthCookies } from '../lib/auth.js';
import { verifyTurnstile } from '../lib/turnstile.js';
import { env } from '../lib/env.js';
import { capture } from '../lib/posthog.js';
import { PosthogEvents } from '@blockd2d/shared';

export async function authRoutes(app: FastifyInstance) {
  app.post('/login', async (req, reply) => {
    const body = LoginSchema.parse(req.body ?? {});
    const isMobile = (req.headers['x-block-client'] || '') === 'mobile';
    const bypass = isMobile && env.MOBILE_TURNSTILE_BYPASS;

    const ts = await verifyTurnstile({ token: body.turnstileToken, ip: req.ip, bypass });
    if (!ts.ok) return reply.code(400).send({ error: ts.error, details: ts.details });

    // Normalize so Supabase lookup and comparison are reliable (whitespace/case can break login)
    const email = String(body.email).trim().toLowerCase();
    const password = String(body.password).trim();

    // Hardcoded dev account (no Supabase) so you can log in and see the app
    if (
      email === DEV_ACCOUNT.email &&
      password === DEV_ACCOUNT.password &&
      !isMobile
    ) {
      const devToken = `${DEV_ACCOUNT.sessionPrefix}${DEV_ACCOUNT.userId}`;
      setAuthCookies(reply, { access_token: devToken, refresh_token: devToken });
      const devUser = {
        id: DEV_ACCOUNT.userId,
        org_id: DEV_ACCOUNT.orgId,
        role: 'admin',
        name: 'Dev User',
        email: DEV_ACCOUNT.email
      };
      return reply.send({ user: devUser, session: undefined });
    }

    const anon = createAnonClient();
    const { data, error } = await anon.auth.signInWithPassword({ email, password });
    if (error || !data.session) return reply.code(401).send({ error: 'Invalid credentials' });

    // load profile to return role/org
    const service = createServiceClient();
    let profile = (await service
      .from('profiles')
      .select('id, org_id, role, name, email')
      .eq('id', data.user.id)
      .single()).data;

    // If no profile (e.g. seed created auth user but profile insert failed or was skipped), try to repair from laborers/reps
    if (!profile) {
      const userId = data.user.id;
      const profileEmail = (data.user.email as string) ?? email ?? '';

      const { data: laborer } = await service
        .from('laborers')
        .select('id, org_id, name')
        .eq('profile_id', userId)
        .limit(1)
        .single();

      if (laborer) {
        const { error: upsertErr } = await service.from('profiles').upsert(
          { id: userId, org_id: laborer.org_id, role: 'labor', name: laborer.name ?? 'Labor', email: profileEmail },
          { onConflict: 'id' }
        );
        if (!upsertErr) {
          profile = { id: userId, org_id: laborer.org_id, role: 'labor' as const, name: laborer.name ?? 'Labor', email: profileEmail };
        }
      }

      if (!profile) {
        const { data: rep } = await service
          .from('reps')
          .select('id, org_id, name')
          .eq('profile_id', userId)
          .limit(1)
          .single();
        if (rep) {
          const { error: upsertErr } = await service.from('profiles').upsert(
            { id: userId, org_id: rep.org_id, role: 'rep', name: rep.name ?? 'Rep', email: profileEmail },
            { onConflict: 'id' }
          );
          if (!upsertErr) {
            profile = { id: userId, org_id: rep.org_id, role: 'rep' as const, name: rep.name ?? 'Rep', email: profileEmail };
          }
        }
      }

      if (!profile) return reply.code(403).send({ error: 'No org profile' });
    }


    // Enforce platform access:
    // - reps and labor are MOBILE ONLY (no web login)
    // - admins/managers are WEB ONLY for MVP (mobile optional later)
    if (!isMobile && (profile.role === 'rep' || profile.role === 'labor')) {
      // Don't set cookies; treat as forbidden for web clients
      return reply.code(403).send({ error: 'Mobile-only account' });
    }

    // Web uses cookies; Mobile uses bearer tokens (still can set cookies, but not required)
    if (!isMobile) {
      setAuthCookies(reply, { access_token: data.session.access_token, refresh_token: data.session.refresh_token });
    }

    await capture(PosthogEvents.ORG_LOGIN, profile.id, {
      org_id: profile.org_id,
      user_id: profile.id,
      role: profile.role
    });

    return reply.send({
      user: profile,
      session: isMobile
        ? { access_token: data.session.access_token, refresh_token: data.session.refresh_token, expires_in: data.session.expires_in }
        : undefined
    });
  });

  app.post('/logout', async (req, reply) => {
    clearAuthCookies(reply);
    return reply.send({ ok: true });
  });

  app.post('/refresh', async (req, reply) => {
    const isMobile = (req.headers['x-block-client'] || '') === 'mobile';
    //fastify-cookie
    const cookieRefresh = req.cookies?.[env.REFRESH_COOKIE_NAME];
    const body: any = req.body || {};
    const refresh = (body.refresh_token as string | undefined) || (cookieRefresh as string | undefined);
    if (!refresh) return reply.code(401).send({ error: 'Missing refresh token' });

    const session = await refreshSession(refresh);
    if (!isMobile) {
      setAuthCookies(reply, { access_token: session.access_token, refresh_token: session.refresh_token });
      return reply.send({ ok: true });
    }
    return reply.send({ session: { access_token: session.access_token, refresh_token: session.refresh_token, expires_in: session.expires_in } });
  });

  app.get('/me', async (req, reply) => {
    if (!req.ctx) return reply.code(401).send({ error: 'Unauthorized' });
    const service = createServiceClient();
    if (req.ctx.user_id === DEV_ACCOUNT.userId) {
      const { data: org } = await service
        .from('organizations')
        .select('name')
        .eq('id', DEV_ACCOUNT.orgId)
        .single();
      return reply.send({
        user: {
          id: DEV_ACCOUNT.userId,
          org_id: DEV_ACCOUNT.orgId,
          role: 'admin',
          name: 'Dev User',
          email: DEV_ACCOUNT.email,
          org_name: org?.name ?? 'Dev Org',
          created_at: new Date().toISOString()
        }
      });
    }
    const { data: profile } = await service
      .from('profiles')
      .select('id, org_id, role, name, email, created_at')
      .eq('id', req.ctx.user_id)
      .single();
    if (!profile) return reply.code(403).send({ error: 'No profile' });
    const { data: org } = await service
      .from('organizations')
      .select('name')
      .eq('id', profile.org_id)
      .single();
    return reply.send({
      user: { ...profile, org_name: org?.name ?? null }
    });
  });

  // Mobile push token (MVP: accept + store later)
  app.post('/me/push-token', async (req, reply) => {
    if (!req.ctx) return reply.code(401).send({ error: 'Unauthorized' });
    const body: any = req.body || {};
    if (typeof body.token !== 'string' || body.token.length < 10) {
      return reply.code(400).send({ error: 'Invalid token' });
    }
    return reply.send({ ok: true });
  });
}
