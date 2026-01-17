import { env } from './env';
export async function verifyTurnstile(opts) {
    if (opts.bypass)
        return { ok: true, skipped: true, bypass: true };
    if (!env.TURNSTILE_SECRET_KEY)
        return { ok: true, skipped: true };
    if (!opts.token)
        return { ok: false, error: 'Missing turnstile token' };
    const form = new URLSearchParams();
    form.set('secret', env.TURNSTILE_SECRET_KEY);
    form.set('response', opts.token);
    if (opts.ip)
        form.set('remoteip', opts.ip);
    const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
        method: 'POST',
        body: form
    });
    const json = await res.json();
    if (json.success)
        return { ok: true };
    return { ok: false, error: 'Turnstile verification failed', details: json };
}
//# sourceMappingURL=turnstile.js.map