import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '../../../../lib/supabase-admin';

function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const token = url.searchParams.get('token') || '';
  if (!token || token.length < 20) return jsonError('Invalid token', 400);

  try {
    const sb = getSupabaseAdmin();
    const { data, error } = await sb
      .from('join_requests')
      .select('status, company_name, created_at, decision_reason')
      .eq('public_token', token)
      .single();

    if (error || !data) return jsonError('Not found', 404);

    // Keep response minimal (no owner email/phone)
    return NextResponse.json({
      status: data.status,
      company_name: data.company_name,
      created_at: data.created_at,
      decision_reason: data.decision_reason
    });
  } catch (e: any) {
    return jsonError(e?.message || 'Request failed', 500);
  }
}

