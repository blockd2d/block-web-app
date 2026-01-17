import Stripe from 'stripe';
import { PaymentCreateIntentSchema, PosthogEvents } from '@blockd2d/shared';
import { createServiceClient } from '../lib/supabase';
import { requireAnyAuthed, requireManager } from './_helpers';
import { env } from '../lib/env';
import { audit } from '../lib/audit';
import { capture } from '../lib/posthog';
function stripeClient() {
    if (!env.STRIPE_SECRET_KEY)
        return null;
    return new Stripe(env.STRIPE_SECRET_KEY, { apiVersion: '2024-06-20' });
}
export async function paymentsRoutes(app) {
    const createCheckoutHandler = async (req, reply) => {
        const ctx = requireAnyAuthed(req);
        // labor can create payment link for their job, managers can for any
        const body = PaymentCreateIntentSchema.parse(req.body ?? {});
        const service = createServiceClient();
        const { data: job } = await service.from('jobs').select('*').eq('id', body.job_id).eq('org_id', ctx.org_id).single();
        if (!job)
            return reply.code(404).send({ error: 'Job not found' });
        if (ctx.role === 'labor') {
            const { data: laborer } = await service.from('laborers').select('id').eq('profile_id', ctx.profile_id).eq('org_id', ctx.org_id).single();
            if (!laborer || job.laborer_id !== laborer.id)
                return reply.code(403).send({ error: 'Forbidden' });
        }
        else {
            requireManager(req);
        }
        if (!stripeClient())
            return reply.code(400).send({ error: 'Stripe not configured' });
        const session = await stripeClient().checkout.sessions.create({
            mode: 'payment',
            line_items: [
                {
                    price_data: {
                        currency: body.currency,
                        unit_amount: body.amount,
                        product_data: { name: 'Service Payment' }
                    },
                    quantity: 1
                }
            ],
            success_url: `${env.PUBLIC_WEB_URL}/pay/success?session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${env.PUBLIC_WEB_URL}/pay/cancel`,
            metadata: { org_id: ctx.org_id, job_id: body.job_id }
        });
        const { data: payment } = await service
            .from('payments')
            .insert({
            org_id: ctx.org_id,
            job_id: body.job_id,
            amount: body.amount,
            currency: body.currency,
            status: 'pending',
            stripe_checkout_session_id: session.id,
            checkout_url: session.url
        })
            .select('*')
            .single();
        await audit(ctx.org_id, ctx.profile_id, 'payment.link_created', { type: 'payment', id: payment.id }, { job_id: body.job_id });
        await capture(PosthogEvents.PAYMENT_LINK_CREATED, ctx.profile_id, { org_id: ctx.org_id, role: ctx.role, job_id: body.job_id, amount: body.amount });
        return reply.send({ payment, url: session.url });
    };
    // MVP: we use Stripe Checkout payment links (labor can send a link to the customer).
    // Spec endpoint is /create-intent; keep /create-checkout for backwards compat.
    app.post('/create-checkout', createCheckoutHandler);
    app.post('/create-intent', createCheckoutHandler);
    // Stripe webhook
    app.post('/stripe/webhook', async (req, reply) => {
        if (!stripeClient() || !env.STRIPE_WEBHOOK_SECRET)
            return reply.code(400).send('stripe not configured');
        const sig = req.headers['stripe-signature'];
        if (!sig || typeof sig !== 'string')
            return reply.code(400).send('missing signature');
        const raw = req.rawBody;
        // If rawBody is unavailable, fall back to JSON stringification (dev)
        const payload = raw ? raw : Buffer.from(JSON.stringify(req.body || {}));
        let event;
        try {
            event = stripeClient().webhooks.constructEvent(payload, sig, env.STRIPE_WEBHOOK_SECRET);
        }
        catch (err) {
            return reply.code(400).send(`Webhook Error: ${err.message}`);
        }
        const service = createServiceClient();
        if (event.type === 'checkout.session.completed') {
            const session = event.data.object;
            const sessionId = session.id;
            await service.from('payments').update({ status: 'paid' }).eq('stripe_checkout_session_id', sessionId);
        }
        return reply.send({ received: true });
    });
}
//# sourceMappingURL=payments.js.map