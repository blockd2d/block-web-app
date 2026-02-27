import { NextResponse } from 'next/server';
import crypto from 'node:crypto';
import { z } from 'zod';
import { getSupabaseAdmin } from '../../../lib/supabase-admin';
import { sendPostmarkEmail } from '../../../lib/postmark';

const JoinRequestSchema = z.object({
  company_name: z.string().min(1),
  owner_full_name: z.string().min(1),
  owner_email: z.string().email(),
  owner_phone: z.string().min(1),
  team_size: z.string().min(1),
  industry: z.string().min(1),
  website: z.string().min(1),
  role: z.string().min(1),
  referral_source: z.string().min(1)
});

function makeToken(bytes = 32) {
  return crypto.randomBytes(bytes).toString('hex'); // 64 chars by default
}

function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export async function POST(req: Request) {
  try {
    const form = await req.formData();
    const raw = Object.fromEntries(form.entries());

    // File is optional and must be read separately
    const logo = form.get('logo');
    if (logo && typeof logo === 'string') {
      // If browser submitted a filename string, ignore.
    }

    const parsed = JoinRequestSchema.safeParse(raw);
    if (!parsed.success) {
      return jsonError(parsed.error.issues[0]?.message || 'Invalid input', 400);
    }

    const sb = getSupabaseAdmin();
    const token = makeToken();

    // Insert join request first (enforces uniqueness via DB index)
    const insert = await sb
      .from('join_requests')
      .insert({
        status: 'pending',
        public_token: token,
        company_name: parsed.data.company_name,
        owner_full_name: parsed.data.owner_full_name,
        owner_email: parsed.data.owner_email,
        owner_phone: parsed.data.owner_phone,
        team_size: parsed.data.team_size,
        industry: parsed.data.industry,
        website: parsed.data.website,
        role: parsed.data.role,
        referral_source: parsed.data.referral_source
      })
      .select('id, public_token')
      .single();

    if (insert.error) {
      const msg = insert.error.message || 'Unable to create request';
      if (/join_requests_owner_email_active_key/i.test(msg) || /duplicate key/i.test(msg)) {
        return jsonError('You already have a pending request for this email. Use your status link, or cancel the existing request.', 409);
      }
      return jsonError(msg, 400);
    }

    const joinRequestId = insert.data.id as string;

    // Optional logo upload (private bucket)
    const file = logo instanceof File ? logo : null;
    if (file && file.size > 0) {
      const mime = file.type || '';
      const ext = mime === 'image/png' ? 'png' : mime === 'image/jpeg' ? 'jpg' : null;
      if (!ext) return jsonError('Logo must be a PNG or JPG.', 400);

      const path = `${joinRequestId}/logo.${ext}`;
      const buf = Buffer.from(await file.arrayBuffer());

      const up = await sb.storage.from('join-request-logos').upload(path, buf, {
        upsert: true,
        contentType: mime
      });
      if (up.error) return jsonError(up.error.message, 400);

      await sb.from('join_requests').update({ logo_object_path: path }).eq('id', joinRequestId);
    }

    // Staff email notification
    const from = process.env.POSTMARK_FROM_EMAIL || 'admin@blockd2d.com';
    const adminTo = 'admin@blockd2d.com';
    const appBaseUrl = process.env.APP_BASE_URL || process.env.NEXT_PUBLIC_WEB_URL || 'http://localhost:3000';
    const statusLink = `${String(appBaseUrl).replace(/\\/$/, '')}/join/status/${encodeURIComponent(insert.data.public_token)}`;

    await sendPostmarkEmail({
      From: from,
      To: adminTo,
      Subject: `New join request: ${parsed.data.company_name}`,
      TextBody:
        `A new join request was submitted.\n\n` +
        `Company: ${parsed.data.company_name}\n` +
        `Owner: ${parsed.data.owner_full_name}\n` +
        `Email: ${parsed.data.owner_email}\n` +
        `Phone: ${parsed.data.owner_phone}\n` +
        `Team size: ${parsed.data.team_size}\n` +
        `Industry: ${parsed.data.industry}\n` +
        `Website: ${parsed.data.website}\n` +
        `Role: ${parsed.data.role}\n` +
        `Referral: ${parsed.data.referral_source}\n\n` +
        `Status link: ${statusLink}\n` +
        `Join request id: ${joinRequestId}\n`
    });

    const redirect = new URL('/join/received', req.url);
    redirect.searchParams.set('token', insert.data.public_token);
    return NextResponse.redirect(redirect, 303);
  } catch (e: any) {
    return jsonError(e?.message || 'Request failed', 500);
  }
}

