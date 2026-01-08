import type { FastifyInstance } from 'fastify';
import { InviteAcceptSchema, InviteCreateSchema, PosthogEvents } from '@block/shared';
import { createAnonClient, createServiceClient } from '../lib/supabase';
import { requireManager, requireRoles } from './_helpers';
import { env } from '../lib/env';
import { audit } from '../lib/audit';
import { capture } from '../lib/posthog';
import { setAuthCookies } from '../lib/auth';

// Node doesn't have crypto.getRandomValues in all contexts; fall back:
function randHex(len = 32) {
  return [...Array(len)]
    .map(() => Math.floor(Math.random() * 16).toString(16))
    .join('');
}

export async function invitesRoutes(app: FastifyInstance) {

  app.get('/', async (req, reply) => {
    const ctx = requireRoles(req, ['admin']);
    const service = createServiceClient();
    const { data, error } = await service
      .from('invites')
      .select('id, org_id, email, role, token, expires_at, accepted_at, created_at')
      .eq('org_id', ctx.org_id)
      .order('created_at', { ascending: false })
      .limit(200);
    if (error) return reply.code(400).send({ error: error.message });
    return reply.send({ invites: data || [] });
  });

  app.post('/', async (req, reply) => {
    const ctx = requireRoles(req, ['admin']);
    const body = InviteCreateSchema.parse(req.body ?? {});
    const token = randHex(64);
    const expires = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7).toISOString();

    const service = createServiceClient();
    const { data, error } = await service
      .from('invites')
      .insert({ org_id: ctx.org_id, email: body.email, role: body.role, token, expires_at: expires })
      .select('*')
      .single();

    if (error) return reply.code(400).send({ error: error.message });

    const acceptLink = `${env.WEB_BASE_URL}/invite/accept?token=${encodeURIComponent(token)}`;

    await audit(ctx.org_id, ctx.profile_id, 'invite.created', { type: 'invite', id: data.id }, { email: body.email, role: body.role });
    await capture(PosthogEvents.INVITE_CREATED, ctx.profile_id, { org_id: ctx.org_id, role: ctx.role, invited_role: body.role });

    return reply.send({ invite: data, acceptLink });
  });

  app.post('/accept', async (req, reply) => {
    const body = InviteAcceptSchema.parse(req.body ?? {});
    const service = createServiceClient();

    const { data: invite } = await service
      .from('invites')
      .select('*')
      .eq('token', body.token)
      .is('accepted_at', null)
      .single();

    if (!invite) return reply.code(400).send({ error: 'Invalid invite' });
    if (new Date(invite.expires_at).getTime() < Date.now()) return reply.code(400).send({ error: 'Invite expired' });

    // Create auth user (email/password) and mark email confirmed
    const { data: created, error: uErr } = await service.auth.admin.createUser({
      email: invite.email,
      password: body.password,
      email_confirm: true,
      user_metadata: { name: body.name }
    });
    if (uErr || !created.user) return reply.code(400).send({ error: uErr?.message || 'Unable to create user' });

    await service.from('profiles').insert({
      id: created.user.id,
      org_id: invite.org_id,
      role: invite.role,
      name: body.name,
      email: invite.email
    });

    await service.from('invites').update({ accepted_at: new Date().toISOString() }).eq('id', invite.id);

    // Create session and set cookies
    const anon = createAnonClient();
    const { data: sessionData, error: sErr } = await anon.auth.signInWithPassword({ email: invite.email, password: body.password });
    if (sErr || !sessionData.session) return reply.code(400).send({ error: 'Created user but unable to sign in' });

    setAuthCookies(reply, { access_token: sessionData.session.access_token, refresh_token: sessionData.session.refresh_token });

    await audit(invite.org_id, created.user.id, 'invite.accepted', { type: 'invite', id: invite.id }, {});
    await capture(PosthogEvents.INVITE_ACCEPTED, created.user.id, { org_id: invite.org_id, role: invite.role });

    return reply.send({ ok: true });
  });
}
