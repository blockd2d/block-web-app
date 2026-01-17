import Fastify from 'fastify';
import cookie from '@fastify/cookie';
import formbody from '@fastify/formbody';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import { env } from './lib/env';
import { buildAuthContext, requireCsrf } from './lib/auth';
import { authRoutes } from './routes/auth';
import { invitesRoutes } from './routes/invites';
import { countiesRoutes } from './routes/counties';
import { propertiesRoutes } from './routes/properties';
import { repsRoutes } from './routes/reps';
import { interactionsRoutes } from './routes/interactions';
import { clusterSetsRoutes } from './routes/cluster-sets';
import { clustersRoutes } from './routes/clusters';
import { salesRoutes } from './routes/sales';
import { contractsRoutes } from './routes/contracts';
import { followupsRoutes } from './routes/followups';
import { messagesRoutes } from './routes/messages';
import { laborRoutes } from './routes/labor';
import { jobsRoutes } from './routes/jobs';
import { paymentsRoutes } from './routes/payments';
import { exportsRoutes } from './routes/exports';
import { analyticsRoutes } from './routes/analytics';
import { dashboardRoutes } from './routes/dashboard';
import { auditRoutes } from './routes/audit';
import { aliasRoutes } from './routes/aliases';
export function buildServer() {
    const app = Fastify({
        logger: {
            level: env.NODE_ENV === 'production' ? 'info' : 'debug'
        }
    });
    app.register(cookie);
    app.register(formbody);
    app.register(cors, {
        origin: true,
        credentials: true
    });
    app.register(rateLimit, {
        max: 300,
        timeWindow: '1 minute'
    });
    // Capture raw body for Stripe webhook signature verification
    app.addContentTypeParser('application/json', { parseAs: 'buffer' }, function (req, body, done) {
        req.rawBody = body;
        try {
            const json = JSON.parse(body.toString('utf8') || '{}');
            done(null, json);
        }
        catch (e) {
            done(e, undefined);
        }
    });
    app.addHook('preHandler', async (req) => {
        req.ctx = await buildAuthContext(req);
    });
    // CSRF for cookie-authenticated state-changing requests
    app.addHook('preHandler', async (req) => {
        const method = req.method.toUpperCase();
        const isWrite = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method);
        if (!isWrite)
            return;
        // allow some endpoints to skip CSRF (webhooks)
        const url = req.url || '';
        // Webhooks (no CSRF)
        if (url.startsWith('/v1/messages/twilio/inbound') ||
            url.startsWith('/v1/payments/stripe/webhook') ||
            url.startsWith('/v1/twilio/inbound') ||
            url.startsWith('/v1/stripe/webhook'))
            return;
        try {
            requireCsrf(req);
        }
        catch (e) {
            // If request uses bearer token, CSRF is skipped in requireCsrf.
            throw e;
        }
    });
    app.get('/health', async () => ({ ok: true, name: 'block-v7-api', env: env.NODE_ENV }));
    app.register(aliasRoutes, { prefix: '/v1' });
    app.register(authRoutes, { prefix: '/v1/auth' });
    app.register(invitesRoutes, { prefix: '/v1/invites' });
    app.register(countiesRoutes, { prefix: '/v1/counties' });
    app.register(propertiesRoutes, { prefix: '/v1/properties' });
    app.register(repsRoutes, { prefix: '/v1/reps' });
    app.register(interactionsRoutes, { prefix: '/v1/interactions' });
    app.register(clusterSetsRoutes, { prefix: '/v1/cluster-sets' });
    // Contract-compatible alias
    app.register(clusterSetsRoutes, { prefix: '/v1/territories' });
    app.register(clustersRoutes, { prefix: '/v1/clusters' });
    app.register(salesRoutes, { prefix: '/v1/sales' });
    app.register(contractsRoutes, { prefix: '/v1/contracts' });
    app.register(followupsRoutes, { prefix: '/v1/followups' });
    app.register(messagesRoutes, { prefix: '/v1/messages' });
    app.register(laborRoutes, { prefix: '/v1/labor' });
    app.register(jobsRoutes, { prefix: '/v1/jobs' });
    app.register(paymentsRoutes, { prefix: '/v1/payments' });
    app.register(exportsRoutes, { prefix: '/v1/exports' });
    app.register(analyticsRoutes, { prefix: '/v1/analytics' });
    app.register(dashboardRoutes, { prefix: '/v1/dashboard' });
    app.register(auditRoutes, { prefix: '/v1/audit' });
    return app;
}
//# sourceMappingURL=server.js.map