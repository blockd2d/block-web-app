import type { FastifyInstance } from 'fastify';
import Stripe from 'stripe';
import { Twilio } from 'twilio';
import { validateRequest } from 'twilio/lib/webhooks/webhooks';
import { createServiceClient } from '../lib/supabase';
import { env } from '../lib/env';

function stripeClient() {
  if (!env.STRIPE_SECRET_KEY) return null;
  return new Stripe(env.STRIPE_SECRET_KEY, { apiVersion: '2024-06-20' });
}

function twilioClient() {
  if (!env.TWILIO_ACCOUNT_SID || !env.TWILIO_AUTH_TOKEN) return null;
  return new Twilio(env.TWILIO_ACCOUNT_SID, env.TWILIO_AUTH_TOKEN);
}

function fullWebhookUrl(req: any) {
  const proto = (req.headers['x-forwarded-proto'] || 'https') as string;
  const host = (req.headers['x-forwarded-host'] || req.headers['host']) as string;
  const url = (req.raw?.url || req.url) as string;
  return `${proto}://${host}${url}`;
}

async function getOrgIdForTwilioNumber(service: any, toNumber: string | null | undefined) {
  if (!toNumber) return null;
  const { data } = await service
    .from('org_settings')
    .select('org_id, twilio_number')
    .eq('twilio_number', toNumber)
    .limit(1)
    .maybeSingle();
  return data?.org_id || null;
}

/**
 * Alias routes required by the API contract:
 * - GET /v1/me (alias of /v1/auth/me)
 * - POST /v1/twilio/inbound (alias of /v1/messages/twilio/inbound)
 * - POST /v1/stripe/webhook (alias of /v1/payments/stripe/webhook)
 *
 * These exist to keep webhook URLs stable even if we refactor route grouping.
 */
export async function aliasRoutes(app: FastifyInstance) {
  app.get('/me', async (req, reply) => {
    if (!req.ctx) return reply.code(401).send({ error: 'Unauthorized' });
    const service = createServiceClient();
    const { data: profile, error } = await service
      .from('profiles')
      .select('id, org_id, role, name, email, created_at')
      .eq('id', req.ctx.user_id)
      .single();
    if (error) return reply.code(400).send({ error: error.message });
    return reply.send({ user: profile });
  });

  // Twilio inbound webhook (x-www-form-urlencoded)
  app.post('/twilio/inbound', async (req, reply) => {
    const service = createServiceClient();

    // Optional Twilio signature validation (recommended in production)
    if (env.TWILIO_AUTH_TOKEN) {
      const signature = req.headers['x-twilio-signature'];
      if (!signature || typeof signature !== 'string') return reply.code(400).send('missing signature');
      const ok = validateRequest(env.TWILIO_AUTH_TOKEN, signature, fullWebhookUrl(req), req.body || {});
      if (!ok) return reply.code(403).send('invalid signature');
    }

    const body: any = req.body || {};
    const from = body.From || body.from;
    const to = body.To || body.to;
    const text = body.Body || body.body;
    const sid = body.MessageSid || body.SmsMessageSid;

    if (!from || !to || !text) return reply.code(400).send('missing');

    const org_id = await getOrgIdForTwilioNumber(service, to);
    if (!org_id) return reply.code(404).send('unknown org');

    // Upsert thread
    const { data: existing } = await service
      .from('message_threads')
      .select('*')
      .eq('org_id', org_id)
      .eq('customer_phone', from)
      .single();

    let threadId = existing?.id;
    if (!threadId) {
      const { data: thread } = await service
        .from('message_threads')
        .insert({ org_id: org_id, rep_id: null, customer_phone: from, last_message_at: new Date().toISOString() })
        .select('*')
        .single();
      threadId = thread!.id;
    } else {
      await service.from('message_threads').update({ last_message_at: new Date().toISOString() }).eq('id', threadId);
    }

    await service.from('messages').insert({
      org_id: org_id,
      thread_id: threadId,
      direction: 'inbound',
      body: text,
      twilio_sid: sid || null,
      status: 'received',
      sent_at: new Date().toISOString()
    });

    reply.header('Content-Type', 'text/plain');
    return reply.send('ok');
  });

  // Stripe webhook
  app.post('/stripe/webhook', async (req, reply) => {
    if (!stripeClient() || !env.STRIPE_WEBHOOK_SECRET) return reply.code(400).send('stripe not configured');
    const sig = req.headers['stripe-signature'];
    if (!sig || typeof sig !== 'string') return reply.code(400).send('missing signature');

    const raw = (req as any).rawBody;
    const payload = raw ? raw : Buffer.from(JSON.stringify(req.body || {}));

    let event: Stripe.Event;
    try {
      event = stripeClient()!.webhooks.constructEvent(payload, sig, env.STRIPE_WEBHOOK_SECRET);
    } catch (err: any) {
      return reply.code(400).send(`Webhook Error: ${err.message}`);
    }

    const service = createServiceClient();

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session;
      const sessionId = session.id;
      await service.from('payments').update({ status: 'paid' }).eq('stripe_checkout_session_id', sessionId);
    }

    return reply.send({ received: true });
  });
}
