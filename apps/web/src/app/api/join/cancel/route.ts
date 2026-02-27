import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSupabaseAdmin } from '../../../../lib/supabase-admin';

const CancelSchema = z.object({ token: z.string().min(20) });

function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export async function POST(req: Request) {
  try {
    const body = CancelSchema.parse(await req.json().catch(() => ({})));
    const sb = getSupabaseAdmin();

    const { data, error } = await sb
      .from('join_requests')
      .select('id, status')
      .eq('public_token', body.token)
      .single();

    if (error || !data) return jsonError('Not found', 404);
    if (data.status !== 'pending') return jsonError('Only pending requests can be cancelled.', 409);

    const up = await sb.from('join_requests').update({ status: 'cancelled' }).eq('id', data.id).eq('status', 'pending');
    if (up.error) return jsonError(up.error.message, 400);

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return jsonError(e?.message || 'Request failed', 500);
  }
}

