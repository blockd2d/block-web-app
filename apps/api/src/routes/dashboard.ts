import type { FastifyInstance } from 'fastify';
import { createServiceClient } from '../lib/supabase';
import { requireAnyAuthed } from './_helpers';
import { getRangeWindow } from './_range';

async function getRepIdForProfile(service: any, org_id: string, profile_id: string) {
  const { data } = await service
    .from('reps')
    .select('id')
    .eq('org_id', org_id)
    .eq('profile_id', profile_id)
    .single();
  return (data?.id as string) || null;
}

function scoreRow(r: { doors: number; leads: number; quotes: number; sold: number; revenue: number }) {
  return r.sold * 200 + r.revenue / 50 + r.quotes * 25 + r.leads * 10 + r.doors * 0.5;
}

function derive(totals: { doors: number; leads: number; sold: number; hours: number }) {
  const doors_per_hour = totals.hours > 0 ? totals.doors / Number(totals.hours) : 0;
  const close_rate = totals.leads > 0 ? totals.sold / totals.leads : 0;
  return { doors_per_hour, close_rate };
}

async function fetchDailyStats(service: any, org_id: string, sinceDay: string, untilDay: string, rep_id?: string | null) {
  let q = service
    .from('daily_stats')
    .select('day, rep_id, doors_knocked, leads, quotes, sold, revenue, hours_worked')
    .eq('org_id', org_id)
    .gte('day', sinceDay)
    .lte('day', untilDay);
  if (rep_id) q = q.eq('rep_id', rep_id);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return data || [];
}

async function countFollowupsDue(service: any, org_id: string, sinceISO: string, rep_id?: string | null) {
  let q = service
    .from('followups')
    .select('id', { count: 'exact', head: true })
    .eq('org_id', org_id)
    .eq('status', 'open')
    .lte('due_at', new Date().toISOString())
    .gte('due_at', sinceISO);
  if (rep_id) q = q.eq('rep_id', rep_id);
  const { count, error } = await q;
  if (error) throw new Error(error.message);
  return count || 0;
}

async function countJobsCompleted(service: any, org_id: string, sinceISO: string, rep_id?: string | null) {
  const { data: jobs, error } = await service
    .from('jobs')
    .select('id, sale_id, completed_at')
    .eq('org_id', org_id)
    .eq('status', 'complete')
    .gte('completed_at', sinceISO);
  if (error) throw new Error(error.message);
  if (!rep_id) return (jobs || []).length;
  if (!jobs?.length) return 0;

  const saleIds = jobs.map((j: any) => j.sale_id).filter(Boolean);
  if (!saleIds.length) return 0;

  const { data: sales, error: sErr } = await service
    .from('sales')
    .select('id, rep_id')
    .eq('org_id', org_id)
    .in('id', saleIds);
  if (sErr) throw new Error(sErr.message);

  const saleRep = new Map((sales || []).map((s: any) => [s.id, s.rep_id]));
  return (jobs || []).filter((j: any) => saleRep.get(j.sale_id) === rep_id).length;
}

async function sumPaymentsCollected(service: any, org_id: string, sinceISO: string, rep_id?: string | null) {
  const { data: payments, error } = await service
    .from('payments')
    .select('id, amount, job_id, status, created_at')
    .eq('org_id', org_id)
    .eq('status', 'paid')
    .gte('created_at', sinceISO);
  if (error) throw new Error(error.message);

  if (!rep_id) return (payments || []).reduce((acc: number, p: any) => acc + (p.amount || 0), 0) / 100;
  if (!payments?.length) return 0;

  const jobIds = payments.map((p: any) => p.job_id).filter(Boolean);
  if (!jobIds.length) return 0;

  const { data: jobs, error: jErr } = await service.from('jobs').select('id, sale_id').eq('org_id', org_id).in('id', jobIds);
  if (jErr) throw new Error(jErr.message);

  const saleIds = (jobs || []).map((j: any) => j.sale_id).filter(Boolean);
  if (!saleIds.length) return 0;

  const { data: sales, error: sErr } = await service.from('sales').select('id, rep_id').eq('org_id', org_id).in('id', saleIds);
  if (sErr) throw new Error(sErr.message);

  const saleRep = new Map((sales || []).map((s: any) => [s.id, s.rep_id]));
  const jobSale = new Map((jobs || []).map((j: any) => [j.id, j.sale_id]));

  const totalCents = (payments || []).reduce((acc: number, p: any) => {
    const saleId = jobSale.get(p.job_id);
    if (saleId && saleRep.get(saleId) === rep_id) return acc + (p.amount || 0);
    return acc;
  }, 0);

  return totalCents / 100;
}

export async function dashboardRoutes(app: FastifyInstance) {
  app.get('/overview', async (req, reply) => {
    const ctx = requireAnyAuthed(req);
    const service = createServiceClient();

    const { range, since, sinceDay, untilDay, priorSinceDay, priorUntilDay } = getRangeWindow((req.query as any)?.range);

    // For rep role, force scope to their rep_id
    let repId: string | null = null;
    if (ctx.role === 'rep') {
      repId = await getRepIdForProfile(service, ctx.org_id, ctx.profile_id);
    }

    const rows = await fetchDailyStats(service, ctx.org_id, sinceDay, untilDay, repId);

    const totals = {
      doors: 0,
      leads: 0,
      quotes: 0,
      sold: 0,
      revenue: 0,
      hours: 0,
      followups_due: 0,
      jobs_completed: 0,
      payments_collected: 0
    };

    for (const r of rows) {
      totals.doors += Number((r as any).doors_knocked || 0);
      totals.leads += Number((r as any).leads || 0);
      totals.quotes += Number((r as any).quotes || 0);
      totals.sold += Number((r as any).sold || 0);
      totals.revenue += Number((r as any).revenue || 0);
      totals.hours += Number((r as any).hours_worked || 0);
    }

    const sinceISO = since.toISOString();
    const [followups_due, jobs_completed, payments_collected] = await Promise.all([
      countFollowupsDue(service, ctx.org_id, sinceISO, repId),
      countJobsCompleted(service, ctx.org_id, sinceISO, repId),
      sumPaymentsCollected(service, ctx.org_id, sinceISO, repId)
    ]);

    totals.followups_due = followups_due;
    totals.jobs_completed = jobs_completed;
    totals.payments_collected = payments_collected;

    const derived = derive(totals);

    // Rep leaderboard (org-wide, even for managers)
    const { data: reps, error: repsErr } = await service
      .from('reps')
      .select('id, name')
      .eq('org_id', ctx.org_id)
      .order('name', { ascending: true });
    if (repsErr) return reply.code(400).send({ error: repsErr.message });

    const repName = new Map<string, string>((reps || []).map((r: any) => [r.id, r.name]));

    const currentAll = await fetchDailyStats(service, ctx.org_id, sinceDay, untilDay, null);

    const agg = new Map<string, any>();
    for (const r of reps || []) {
      agg.set(r.id, { rep_id: r.id, rep_name: r.name, doors: 0, leads: 0, quotes: 0, sold: 0, revenue: 0, hours: 0 });
    }
    for (const row of currentAll) {
      const id = (row as any).rep_id;
      if (!id) continue;
      const a = agg.get(id) || { rep_id: id, rep_name: repName.get(id) || 'Rep', doors: 0, leads: 0, quotes: 0, sold: 0, revenue: 0, hours: 0 };
      a.doors += Number((row as any).doors_knocked || 0);
      a.leads += Number((row as any).leads || 0);
      a.quotes += Number((row as any).quotes || 0);
      a.sold += Number((row as any).sold || 0);
      a.revenue += Number((row as any).revenue || 0);
      a.hours += Number((row as any).hours_worked || 0);
      agg.set(id, a);
    }

    const priorScore = new Map<string, number>();
    if (priorSinceDay && priorUntilDay) {
      const priorRows = await fetchDailyStats(service, ctx.org_id, priorSinceDay, priorUntilDay, null);
      const tmp = new Map<string, any>();
      for (const row of priorRows) {
        const id = (row as any).rep_id;
        if (!id) continue;
        const a = tmp.get(id) || { doors: 0, leads: 0, quotes: 0, sold: 0, revenue: 0 };
        a.doors += Number((row as any).doors_knocked || 0);
        a.leads += Number((row as any).leads || 0);
        a.quotes += Number((row as any).quotes || 0);
        a.sold += Number((row as any).sold || 0);
        a.revenue += Number((row as any).revenue || 0);
        tmp.set(id, a);
      }
      for (const [id, a] of tmp.entries()) priorScore.set(id, scoreRow(a));
    }

    const repLeaderboard = Array.from(agg.values()).map((r: any) => {
      const score = scoreRow(r);
      const delta_score = score - (priorScore.get(r.rep_id) || 0);
      return {
        rep_id: r.rep_id,
        rep_name: r.rep_name,
        doors: r.doors,
        sold: r.sold,
        revenue: r.revenue,
        score,
        delta_score
      };
    });

    repLeaderboard.sort((a: any, b: any) => b.score - a.score);

    return reply.send({ range, since: sinceDay, until: untilDay, totals, derived, repLeaderboard });
  });
}
