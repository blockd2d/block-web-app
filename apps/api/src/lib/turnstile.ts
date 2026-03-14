import { env } from './env.js';

export async function verifyTurnstile(opts: { token?: string | null; ip?: string | null; bypass?: boolean }) {
  if (opts.bypass) return { ok: true, skipped: true, bypass: true };
  if (!env.TURNSTILE_SECRET_KEY) return { ok: true, skipped: true };
  // Web app has no Turnstile widget yet; allow login without token (skip verification)
  if (!opts.token) return { ok: true, skipped: true };

  const form = new URLSearchParams();
  form.set('secret', env.TURNSTILE_SECRET_KEY);
  form.set('response', opts.token);
  if (opts.ip) form.set('remoteip', opts.ip);

  const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: form.toString(),
  });
  const json: any = await res.json();
  if (json.success) return { ok: true };
  return { ok: false, error: 'Turnstile verification failed', details: json };
}
